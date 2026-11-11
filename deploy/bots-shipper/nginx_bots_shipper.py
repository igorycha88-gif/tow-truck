#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""nginx_bots_shipper — импорт бот-запросов из nginx access-лога в BotVisit.

ADR-016 / ЧТЗ_Мониторинг_ботов_Grafana.md.

Поток данных:
  /var/log/nginx/evakuaciya-online.access.log
    → инкрементальное чтение (state: inode+offset)
    → классификация User-Agent (реестр ботов + generic-фолбэк)
    → маскирование IP (152-ФЗ: IPv4 → /24, IPv6 → /64)
    → INSERT ... ON CONFLICT (id) DO NOTHING через docker exec psql
    → таблица "BotVisit" (читает Grafana, дашборд «Боты и люди»).

Режимы:
  (без аргументов)     — инкрементальный импорт текущего лога (+ хвост .log.1,
                         чтобы не терять строки на границе logrotate).
  --retro              — разовый импорт всей истории: *.log.N.gz + .log.1 + .log.

Запуск на VPS по cron каждые 5 минут (setup-vps.sh). stdlib-only (python3.8+).
"""

import argparse
import fcntl
import gzip
import hashlib
import ipaddress
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime
from logging.handlers import RotatingFileHandler
from typing import IO, Iterable, List, Optional, Tuple

# ── Конфигурация (значения по умолчанию; переопределяются ключами CLI) ──────

DEFAULT_LOG = '/var/log/nginx/evakuaciya-online.access.log'
DEFAULT_STATE = '/var/lib/nginx-bots-shipper/state.json'
DEFAULT_LOCK = '/var/lib/nginx-bots-shipper/lock'
DEFAULT_LOGFILE = '/var/log/nginx-bots-shipper.log'
DEFAULT_ENV = '/root/tow-truck/.env'  # POSTGRES_USER / POSTGRES_DB (chmod 600)
DB_CONTAINER = 'tow-truck-db'
INSERT_CHUNK = 200  # строк на один INSERT (лимиты argv не задействованы: SQL через stdin)

# Пути, которые НЕ являются визитами ботов на сайт (сам мониторинг и Grafana).
EXCLUDED_PATH_PREFIXES = ('/grafana', '/metrics')

# ── Парсинг combined-формата nginx ──────────────────────────────────────────
# $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent
# "$http_referer" "$http_user_agent"

LINE_RE = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+\S+\s+'  # ip - user [мы не храним user]
    r'\[(?P<time>[^\]]+)\]\s+'
    r'"(?P<request>[^"]*)"\s+'
    r'(?P<status>\d{3})\s+(?P<bytes>\S+)\s+'
    r'"(?P<referer>[^"]*)"\s+'
    r'"(?P<ua>[^"]*)"'
)

TIME_FORMAT = '%d/%b/%Y:%H:%M:%S %z'

# ── Реестр известных ботов: (подстрока UA в нижнем регистре, имя, вендор) ────
# Порядок важен: более специфичные паттерны раньше общих (YandexMetrika
# содержит "yandex" — но реестр проверяется по уникальным подстрокам, конфликта нет).

BOT_REGISTRY: List[Tuple[str, str, str]] = [
    # Яндекс
    ('yandexbot', 'YandexBot', 'yandex'),
    ('yandexmetrika', 'YandexMetrika', 'yandex'),
    ('yandeximages', 'YandexImages', 'yandex'),
    ('yandexvideo', 'YandexVideo', 'yandex'),
    ('yandexwebmaster', 'YandexWebmaster', 'yandex'),
    ('yandexdirect', 'YandexDirect', 'yandex'),
    ('yandexrca', 'YandexRCA', 'yandex'),
    ('yandexsitelinks', 'YandexSitelinks', 'yandex'),
    ('yandexaccessibility', 'YandexAccessibility', 'yandex'),
    ('yandexadnet', 'YandexAdNet', 'yandex'),
    ('yandexadvertising', 'YandexAdvertising', 'yandex'),
    ('yandexnews', 'YandexNews', 'yandex'),
    ('yandexturbo', 'YandexTurbo', 'yandex'),
    ('yandexmedia', 'YandexMedia', 'yandex'),
    ('yandexfavicons', 'YandexFavicons', 'yandex'),
    ('yandexmobilescreen', 'YandexMobileScreenShotBot', 'yandex'),
    ('yandexcalendar', 'YandexCalendar', 'yandex'),
    ('yandexssd', 'YandexSSD', 'yandex'),
    ('yadirectfetcher', 'YaDirectFetcher', 'yandex'),
    ('yandex', 'YandexOther', 'yandex'),  # прочие робеты Яндекса
    # Google
    ('googlebot-image', 'Googlebot-Image', 'google'),
    ('googlebot-news', 'Googlebot-News', 'google'),
    ('googlebot-video', 'Googlebot-Video', 'google'),
    ('googlebot', 'Googlebot', 'google'),
    ('google-inspectiontool', 'Google-InspectionTool', 'google'),
    ('adsbot-google', 'AdsBot-Google', 'google'),
    ('feedfetcher-google', 'FeedFetcher-Google', 'google'),
    ('mediapartners-google', 'Mediapartners-Google', 'google'),
    ('googleproducer', 'GoogleProducer', 'google'),
    # Bing / Microsoft
    ('bingbot', 'Bingbot', 'bing'),
    ('bingpreview', 'BingPreview', 'bing'),
    ('adidxbot', 'AdIdxBot', 'bing'),
    ('bingads', 'BingAds', 'bing'),
    # OpenAI
    ('gptbot', 'GPTBot', 'openai'),
    ('oai-searchbot', 'OAI-SearchBot', 'openai'),
    ('chatgpt-user', 'ChatGPT-User', 'openai'),
    # Прочие известные
    ('claudebot', 'ClaudeBot', 'other'),
    ('claude-web', 'Claude-Web', 'other'),
    ('applebot', 'Applebot', 'other'),
    ('duckduckbot', 'DuckDuckBot', 'other'),
    ('ahrefsbot', 'AhrefsBot', 'other'),
    ('semrushbot', 'SemrushBot', 'other'),
    ('mj12bot', 'MJ12bot', 'other'),
    ('dotbot', 'DotBot', 'other'),
    ('petalbot', 'PetalBot', 'other'),
    ('seznambot', 'SeznamBot', 'other'),
    ('mail.ru_bot', 'Mail.RU_Bot', 'other'),
    ('mailru', 'Mail.RU_Bot', 'other'),
    ('sputnikbot', 'SputnikBot', 'other'),
    ('facebookbot', 'FacebookBot', 'other'),
    ('meta-externalagent', 'Meta-ExternalAgent', 'other'),
    ('linkedinbot', 'LinkedInBot', 'other'),
    ('xingbot', 'XingBot', 'other'),
    ('twitterbot', 'Twitterbot', 'other'),
    ('bytespider', 'Bytespider', 'other'),
    ('ccbot', 'CCBot', 'other'),
    ('amazonbot', 'Amazonbot', 'other'),
    ('perplexitybot', 'PerplexityBot', 'other'),
    ('serpstatbot', 'SerpstatBot', 'other'),
]

# Generic-фолбэк: неизвестные краулеры (bot/crawler/spider/slurp в любом месте UA).
GENERIC_BOT_RE = re.compile(r'\b(\S*[a-z0-9_-]*(?:bot|crawler|spider|slurp)[a-z0-9_-]*)\b', re.I)

log = logging.getLogger('nginx-bots-shipper')


# ── Классификация User-Agent ────────────────────────────────────────────────

def classify_ua(ua: Optional[str]) -> Optional[Tuple[str, str]]:
    """UA → (botName, vendor) для ботов; None для людей.

    Сравнение по подстрокам в нижнем регистре; для реестра — ищем точное
    вхождение ключа. Подделки UA («Googlebot» в браузерном хвосте) здесь не
    верифицируются rDNS: назначение — статистика, не access-control (ADR-016).
    """
    if not ua or ua == '-':
        return None
    ua_lower = ua.lower()
    for key, name, vendor in BOT_REGISTRY:
        if key in ua_lower:
            return name, vendor
    m = GENERIC_BOT_RE.search(ua)
    if m:
        token = re.sub(r'[^A-Za-z0-9._/-]', '', m.group(1))
        return (token or 'UnknownBot'), 'other'
    return None


# ── Маскирование IP (152-ФЗ; те же правила, что maskIp в src/lib/utils.ts) ──

def mask_ip(ip: Optional[str]) -> Optional[str]:
    """IPv4 → /24 (последний октет 0), IPv6 → /64. Невалидное → None."""
    if not ip or ip == '-':
        return None
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return None
    prefix = 24 if addr.version == 4 else 64
    net = ipaddress.ip_network((ip, prefix), strict=False)
    return str(net.network_address)


# ── Разбор строки лога ──────────────────────────────────────────────────────

def parse_line(line: str) -> Optional[dict]:
    """combined-строка nginx → dict с полями BotVisit; None = пропустить.

    Выбрасывает ValueError на битую строку (вызывающий логирует и продолжает).
    """
    m = LINE_RE.match(line)
    if not m:
        raise ValueError('unparseable line')
    g = m.groupdict()

    ts = datetime.strptime(g['time'], TIME_FORMAT)

    # "$request": METHOD target PROTO | битая → None
    parts = g['request'].split(' ')
    if len(parts) != 3:
        return None
    method, target = parts[0], parts[1]

    if '?' in target:
        path, query = target.split('?', 1)
    else:
        path, query = target, None

    # Исключаем служебные пути (Grafana/мониторинг — не визиты ботов на сайт)
    if path.startswith(EXCLUDED_PATH_PREFIXES):
        return None

    ua = g['ua'] if g['ua'] != '-' else None
    referer = g['referer'] if g['referer'] != '-' else None

    raw_ip = g['ip']
    det_id = make_id(ts, raw_ip, method, target, g['ua'])

    return {
        'id': det_id,
        'ts': ts.strftime('%Y-%m-%dT%H:%M:%S%z')[:-2] + ':' + ts.strftime('%z')[-2:],
        'ip': mask_ip(raw_ip),
        'method': method,
        'path': path,
        'query': query,
        'status': int(g['status']),
        'referer': referer,
        'userAgent': ua,
    }


def make_id(ts: datetime, ip: str, method: str, target: str, ua: str) -> str:
    """Детерминированный id: md5 от сырых полей строки → повторный импорт
    той же строки не создаёт дублей (ON CONFLICT DO NOTHING)."""
    key = '|'.join([
        ts.strftime('%Y-%m-%dT%H:%M:%S%z'), ip or '-', method or '-',
        target or '-', ua or '-',
    ])
    return hashlib.md5(key.encode('utf-8')).hexdigest()


# ── SQL ─────────────────────────────────────────────────────────────────────

def sql_str(v: Optional[str]) -> str:
    """SQL-литерал: NULL или 'строка' с удвоенными кавычками-апострофами."""
    if v is None:
        return 'NULL'
    return "'" + v.replace("'", "''") + "'"


def build_insert(rows: List[dict]) -> str:
    values = []
    for r in rows:
        values.append(
            '({id}, {ts}, {bot}, {vendor}, {ip}, {method}, {path}, {query}, '
            '{status}, {referer}, {ua}, now())'.format(
                id=sql_str(r['id']),
                ts=sql_str(r['ts']),
                bot=sql_str(r['botName']),
                vendor=sql_str(r['vendor']),
                ip=sql_str(r['ip']),
                method=sql_str(r['method']),
                path=sql_str(r['path']),
                query=sql_str(r['query']),
                status=str(r['status']),
                referer=sql_str(r['referer']),
                ua=sql_str(r['userAgent']),
            )
        )
    return (
        'INSERT INTO "BotVisit"("id","ts","botName","vendor","ip","method",'
        '"path","query","status","referer","userAgent","createdAt") VALUES\n  '
        + ',\n  '.join(values)
        + '\nON CONFLICT ("id") DO NOTHING;'
    )


def db_credentials(env_path: str) -> Tuple[str, str]:
    """POSTGRES_USER/POSTGRES_DB из .env проекта (на VPS chmod 600)."""
    user, db = 'postgres', 'tow_truck'
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as fh:
            for line in fh:
                line = line.strip()
                if line.startswith('POSTGRES_USER='):
                    user = line.split('=', 1)[1].strip().strip('"')
                elif line.startswith('POSTGRES_DB='):
                    db = line.split('=', 1)[1].strip().strip('"')
    else:
        log.warning('env file not found, using defaults: %s', env_path)
    return user, db


def write_rows(rows: List[dict], env_path: str) -> int:
    """rows → BotVisit через psql (SQL-скрипт по stdin, без лимитов argv).

    Возвращает количество реально вставленных строк (из отчёта psql
    INSERT 0 N, суммарно по чанкам).
    """
    if not rows:
        return 0
    user, db = db_credentials(env_path)

    statements = ['BEGIN;']
    for i in range(0, len(rows), INSERT_CHUNK):
        statements.append(build_insert(rows[i:i + INSERT_CHUNK]))
    statements.append('COMMIT;')
    script = '\n'.join(statements)

    with tempfile.NamedTemporaryFile('w', encoding='utf-8', delete=False) as tmp:
        tmp.write(script)
        tmp_path = tmp.name
    try:
        with open(tmp_path, 'rb') as stdin_fh:
            proc = subprocess.run(
                ['docker', 'exec', '-i', DB_CONTAINER,
                 'psql', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1'],
                stdin=stdin_fh, capture_output=True, text=True, timeout=120,
            )
        if proc.returncode != 0:
            raise RuntimeError('psql failed: %s' % proc.stderr.strip()[:2000])
        inserted = sum(int(m) for m in re.findall(r'INSERT 0 (\d+)', proc.stdout))
        return inserted
    finally:
        os.unlink(tmp_path)


# ── Чтение логов ────────────────────────────────────────────────────────────

def open_log(path: str) -> IO[str]:
    if path.endswith('.gz'):
        return gzip.open(path, 'rt', encoding='utf-8', errors='replace')
    return open(path, 'r', encoding='utf-8', errors='replace')


def collect_bots(lines: Iterable[str], source: str) -> List[dict]:
    """Строки лога → бот-записи BotVisit (люди пропускаются, битые — warn)."""
    rows: List[dict] = []
    seen: set = set()
    skipped_humans = 0
    for line in lines:
        line = line.rstrip('\n')
        if not line:
            continue
        try:
            parsed = parse_line(line)
        except ValueError:
            log.warning('skip unparseable line in %s: %s', source, line[:300])
            continue
        if parsed is None:
            continue
        classified = classify_ua(parsed['userAgent'])
        if classified is None:
            skipped_humans += 1
            continue
        bot_name, vendor = classified
        if parsed['id'] in seen:
            continue
        seen.add(parsed['id'])
        parsed['botName'] = bot_name
        parsed['vendor'] = vendor
        rows.append(parsed)
    if skipped_humans:
        log.info('%s: skipped %d non-bot requests', source, skipped_humans)
    return rows


# ── State (инкрементальное чтение) ──────────────────────────────────────────

def load_state(path: str) -> dict:
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def save_state(path: str, state: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(state, fh)


def run_incremental(log_path: str, state_path: str, env_path: str) -> None:
    state = load_state(state_path)

    # 1) Хвост предыдущего суточного лога: на границе logrotate строки между
    #    последним offset и моментом ротации остаются в .log.1 — читаем его
    #    целиком каждый запуск (дубли отсеивает детерминированный id).
    rotated = log_path + '.1'
    rows: List[dict] = []
    if os.path.exists(rotated):
        with open_log(rotated) as fh:
            rows = collect_bots(fh, rotated)
        if rows:
            log.info('rotated tail %s: %d bot rows', rotated, len(rows))

    # 2) Текущий лог от offset (смена inode → читаем с начала, дедуп прикроет)
    try:
        inode = os.stat(log_path).st_ino
    except OSError:
        log.error('log file not found: %s', log_path)
        if rows:
            inserted = write_rows(rows, env_path)
            log.info('inserted (rotated only): %d', inserted)
        return

    offset = state.get('offset', 0) if state.get('inode') == inode else 0
    new_rows = []
    with open(log_path, 'r', encoding='utf-8', errors='replace') as fh:
        fh.seek(offset)
        new_rows = collect_bots(fh, log_path)
        new_offset = fh.tell()
    rows.extend(new_rows)

    inserted = write_rows(rows, env_path)
    save_state(state_path, {'inode': inode, 'offset': new_offset})
    log.info('incremental: %d bot rows pending, %d inserted, offset %d→%d',
             len(rows), inserted, offset, new_offset)


def run_retro(log_path: str, env_path: str) -> None:
    """Импорт всей истории: *.gz (по возрастанию), .log.1, текущий .log."""
    import glob as globmod
    gz_logs = sorted(globmod.glob(log_path + '.*.gz'))
    candidates = []
    for p in gz_logs:
        m = re.search(r'\.(\d+)\.gz$', p)
        if m:
            candidates.append((int(m.group(1)), p))
    candidates.sort(key=lambda t: -t[0])  # .14 (старейший) → .2
    ordered = [p for _, p in candidates]

    rotated = log_path + '.1'
    if os.path.exists(rotated):
        ordered.append(rotated)
    if os.path.exists(log_path):
        ordered.append(log_path)

    total = 0
    for path in ordered:
        with open_log(path) as fh:
            rows = collect_bots(fh, path)
        if rows:
            inserted = write_rows(rows, env_path)
            total += inserted
            log.info('retro %s: %d rows, %d inserted', path, len(rows), inserted)
    log.info('retro finished: files=%d, inserted=%d', len(ordered), total)


# ── main ────────────────────────────────────────────────────────────────────

def setup_logging(logfile: str) -> None:
    os.makedirs(os.path.dirname(logfile), exist_ok=True)
    handler = RotatingFileHandler(logfile, maxBytes=2 * 1024 * 1024,
                                  backupCount=2, encoding='utf-8')
    fmt = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
    handler.setFormatter(fmt)
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(handler)


def main() -> int:
    ap = argparse.ArgumentParser(description='Import bot hits from nginx log to BotVisit')
    ap.add_argument('--log', default=DEFAULT_LOG, help='nginx access log path')
    ap.add_argument('--state', default=DEFAULT_STATE, help='state file (inode+offset)')
    ap.add_argument('--lock', default=DEFAULT_LOCK, help='flock file')
    ap.add_argument('--logfile', default=DEFAULT_LOGFILE, help='own log file')
    ap.add_argument('--env', default=DEFAULT_ENV, help='project .env for POSTGRES_*')
    ap.add_argument('--retro', action='store_true', help='import all rotated logs')
    args = ap.parse_args()

    setup_logging(args.logfile)
    log.info('start (%s)', 'retro' if args.retro else 'incremental')

    # flock: параллельные запуски (cron vs retro) не конфликтуют
    os.makedirs(os.path.dirname(args.lock), exist_ok=True)
    lock_fh = open(args.lock, 'w')
    try:
        fcntl.flock(lock_fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        log.info('another instance is running, exit')
        return 0

    try:
        if args.retro:
            run_retro(args.log, args.env)
        else:
            run_incremental(args.log, args.state, args.env)
        log.info('done')
        return 0
    except Exception:
        log.exception('shipper failed')
        return 1


if __name__ == '__main__':
    sys.exit(main())
