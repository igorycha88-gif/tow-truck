import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Валидация WAF-конфига nginx (ЧТЗ_Метрика_прод_и_WAF_боты.md, TASK-QA-003).
//
// Гарантирует, что в map $blocked_agent (deploy/nginx/evakuaciya-protection.conf):
//  1. allow-правила (0) для ботов Яндекса/поисковиков и мониторинга объявлены
//     РАНЬШЕ первого блок-паттерна (1) — nginx map: first-match-wins;
//  2. присутствуют ключевые allow-паттерны (yandex, yadirect, googlebot, …);
//  3. блок-лист сканеров не пуст и содержит ключевые паттерны (защита не ослаблена);
//  4. ID счётчика Метрики согласован между docker-compose.dev.yml и .env.example.

const ROOT = process.cwd();
const CONF = readFileSync(join(ROOT, 'deploy/nginx/evakuaciya-protection.conf'), 'utf8');

// Строки map-директив: «    ~*yandex   0; » → { pattern: '~*yandex', value: '0' }.
type MapEntry = { pattern: string; value: string; index: number };

function parseMapEntries(conf: string): MapEntry[] {
  const entries: MapEntry[] = [];
  const re = /^[ \t]*(~\*?\S+|default)[ \t]+([01]);[ \t]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conf)) !== null) {
    entries.push({ pattern: m[1], value: m[2], index: m.index });
  }
  return entries;
}

const entries = parseMapEntries(CONF);
const allows = entries.filter((e) => e.value === '0' && e.pattern !== 'default');
const blocks = entries.filter((e) => e.value === '1');

describe('waf-protection.conf: структура', () => {
  it('map содержит default 0 и распарсен', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.pattern === 'default' && e.value === '0')).toBe(true);
  });

  it('блок-лист сканеров не пуст', () => {
    expect(blocks.length).toBeGreaterThan(5);
  });
});

describe('waf-protection.conf: allow-правила ботов и мониторинга', () => {
  const REQUIRED_ALLOWS = [
    'yandex', // все краулеры Яндекса (YandexBot, YandexMetrika, YandexWebmaster…)
    'yadirect', // YaDirectFetcher (верификатор Директа, не содержит «yandex»)
    'googlebot',
    'google-inspectiontool', // Google Search Console
    'bingbot',
    'uptime', // UptimeRobot / Uptime-Kuma / BetterUptime
    'checkhost',
    'pingdom',
  ];

  it.each(REQUIRED_ALLOWS)('allow-паттерн присутствует: %s', (needle) => {
    expect(allows.some((e) => e.pattern.includes(needle))).toBe(true);
  });

  it('все allow-правила объявлены РАНЬШЕ первого блок-паттерна (first-match-wins)', () => {
    const firstBlockIndex = Math.min(...blocks.map((e) => e.index));
    for (const a of allows) {
      expect(
        a.index,
        `allow «${a.pattern}» должен стоять раньше блок-паттернов`,
      ).toBeLessThan(firstBlockIndex);
    }
  });

  it('реальные UA Яндекс-ботов матчатся allow-паттернами и НЕ матчатся блок-паттернами', () => {
    const yandexUAs = [
      'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
      'Mozilla/5.0 (compatible; YandexMetrika/2.0; +http://yandex.com/bots)',
      'YandexWebmaster/2.0',
      'Mozilla/5.0 (compatible; YandexDirect/3.0; +http://yandex.com/bots)',
      'YaDirectFetcher/1.0',
    ];
    const toNginxRegex = (pattern: string): RegExp => {
      const body = pattern.replace(/^~\*/, '').replace(/^\~/, '');
      // nginx regex — POSIX, чувствительность снята ~*; экранирование как в JS.
      return new RegExp(body, 'i');
    };
    for (const ua of yandexUAs) {
      const allowed = allows.some((e) => toNginxRegex(e.pattern).test(ua));
      const blockedUa = blocks.some((e) => toNginxRegex(e.pattern).test(ua));
      expect(allowed, `UA «${ua}» должен разрешаться`).toBe(true);
      expect(blockedUa, `UA «${ua}» не должен блокироваться`).toBe(false);
    }
  });

  it('сканерские UA по-прежнему блокируются (защита не ослаблена)', () => {
    const scannerUAs = ['nuclei', 'sqlmap/1.7', 'Go-http-client/2.0', 'python-httpx/0.27'];
    const toNginxRegex = (pattern: string): RegExp =>
      new RegExp(pattern.replace(/^~\*/, '').replace(/^\~/, ''), 'i');
    for (const ua of scannerUAs) {
      const blockedUa = blocks.some((e) => toNginxRegex(e.pattern).test(ua));
      expect(blockedUa, `UA «${ua}» должен блокироваться (403)`).toBe(true);
    }
  });
});

describe('Метрика: согласованность ID счётчика (111456265)', () => {
  const METRIKA_ID = '111456265';

  it('docker-compose.dev.yml содержит NEXT_PUBLIC_METRIKA_ID', () => {
    const dev = readFileSync(join(ROOT, 'docker-compose.dev.yml'), 'utf8');
    expect(dev).toContain(`NEXT_PUBLIC_METRIKA_ID: '${METRIKA_ID}'`);
  });

  it('.env.example содержит NEXT_PUBLIC_METRIKA_ID', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
    expect(example).toContain(`NEXT_PUBLIC_METRIKA_ID="${METRIKA_ID}"`);
  });

  it('Dockerfile прокидывает NEXT_PUBLIC_METRIKA_ID как build-arg в builder', () => {
    // Статические страницы прендерятся при next build: без ARG счётчик
    // не попадёт в HTML даже при runtime env (ЧТЗ_Метрика_прод_и_WAF_боты).
    const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/ARG NEXT_PUBLIC_METRIKA_ID=/);
    expect(dockerfile).toMatch(/ENV NEXT_PUBLIC_METRIKA_ID=\$NEXT_PUBLIC_METRIKA_ID/);
  });

  it('CI (docker-publish.yml) передаёт боевой ID счётчика в build-args', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/docker-publish.yml'), 'utf8');
    expect(ci).toContain(`NEXT_PUBLIC_METRIKA_ID=${METRIKA_ID}`);
  });
});
