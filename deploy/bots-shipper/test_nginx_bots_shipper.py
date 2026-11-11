#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Юнит-тесты nginx_bots_shipper (ADR-016, ЧТЗ §7).

Запуск:  python3 deploy/bots-shipper/test_nginx_bots_shipper.py
 (или:    python3 -m unittest discover -s deploy/bots-shipper -p 'test_*.py')

Тестовые строки — реальные записи combined-лога с прода (эвакуация.online).
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from nginx_bots_shipper import (  # noqa: E402
    classify_ua,
    collect_bots,
    build_insert,
    db_credentials,
    make_id,
    mask_ip,
    parse_line,
    sql_str,
)

# Реальные UA с прода (11.11.2026)
LINE_YANDEX_METRIKA = (
    '5.255.253.17 - - [11/Nov/2026:09:45:06 +0300] "GET /?yclid=7710547526903176844 '
    'HTTP/1.1" 200 15370 "-" "Mozilla/5.0 (compatible; YandexMetrika/2.0; '
    '+http://yandex.com/bots yabs01)"'
)
LINE_YANDEX_BOT = (
    '141.98.11.20 - - [11/Nov/2026:07:24:17 +0300] "GET /nochnoj-evakuator HTTP/1.1" '
    '200 18446 "-" "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)"'
)
LINE_GOOGLEBOT_IMAGE = (
    '66.249.66.1 - - [11/Nov/2026:04:12:00 +0300] "GET /images/hero.webp HTTP/1.1" '
    '200 52310 "-" "Googlebot-Image/1.0"'
)
LINE_GOOGLEBOT_MOBILE = (
    '66.249.66.99 - - [11/Nov/2026:05:00:00 +0300] "GET /ceny HTTP/1.1" 200 21000 "-" '
    '"Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/157.0.8103.50 Mobile Safari/537.36 (compatible; Googlebot/2.1; '
    '+http://www.google.com/bot.html)"'
)
LINE_GPTBOT = (
    '20.171.207.4 - - [11/Nov/2026:03:00:00 +0300] "GET /politika HTTP/1.1" 200 9021 '
    '"-" "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4; '
    '+https://openai.com/gptbot)"'
)
LINE_HUMAN_IPHONE = (
    '95.161.220.11 - - [11/Nov/2026:09:10:00 +0300] "GET / HTTP/1.1" 200 15370 '
    '"https://yandex.ru/" "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
    'Mobile Safari/604.1"'
)
LINE_IPV6 = (
    '2a02:6b8:c2c::100:1 - - [11/Nov/2026:06:26:24 +0300] "GET /robots.txt HTTP/1.1" '
    '200 512 "-" "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)"'
)
LINE_404 = (
    '10.0.0.1 - - [11/Nov/2026:08:54:01 +0300] "GET /.boto HTTP/1.1" 404 0 "-" '
    '"Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"'
)


class TestParseLine(unittest.TestCase):
    def test_full_yandex_metrika_with_yclid(self):
        row = parse_line(LINE_YANDEX_METRIKA)
        self.assertIsNotNone(row)
        self.assertEqual(row['path'], '/')
        self.assertEqual(row['query'], 'yclid=7710547526903176844')
        self.assertEqual(row['status'], 200)
        self.assertEqual(row['method'], 'GET')
        self.assertEqual(row['ts'], '2026-11-11T09:45:06+03:00')
        self.assertEqual(row['referer'], None)
        self.assertEqual(row['ip'], '5.255.253.0')  # маскирован 152-ФЗ

    def test_referer_and_referer_dash(self):
        row = parse_line(LINE_HUMAN_IPHONE)
        self.assertEqual(row['referer'], 'https://yandex.ru/')
        row2 = parse_line(LINE_YANDEX_METRIKA)
        self.assertIsNone(row2['referer'])

    def test_ipv6_masked_to_64(self):
        row = parse_line(LINE_IPV6)
        self.assertEqual(row['ip'], '2a02:6b8:c2c::')

    def test_404_still_imported(self):
        row = parse_line(LINE_404)
        self.assertEqual(row['status'], 404)
        self.assertEqual(row['path'], '/.boto')

    def test_unparseable_line_raises(self):
        with self.assertRaises(ValueError):
            parse_line('garbage line without structure')

    def test_bad_request_field_returns_none(self):
        line = ('1.2.3.4 - - [11/Nov/2026:00:00:00 +0300] "-" 400 0 "-" "-"')
        self.assertIsNone(parse_line(line))

    def test_excluded_paths_grafana_metrics(self):
        for path in ('/grafana', '/grafana/d/abc', '/metrics/node', '/metrics/tracking'):
            line = ('1.2.3.4 - - [11/Nov/2026:00:00:00 +0300] "GET %s HTTP/1.1" '
                    '200 10 "-" "Mozilla/5.0 (compatible; YandexBot/3.0)"' % path)
            self.assertIsNone(parse_line(line), path)


class TestClassifyUa(unittest.TestCase):
    CASES = [
        ('Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 'YandexBot', 'yandex'),
        ('Mozilla/5.0 (compatible; YandexMetrika/2.0; +http://yandex.com/bots yabs01)', 'YandexMetrika', 'yandex'),
        ('Googlebot-Image/1.0', 'Googlebot-Image', 'google'),
        ('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Googlebot', 'google'),
        ('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0)', 'Bingbot', 'bing'),
        ('Mozilla/5.0 (compatible; GPTBot/1.4; +https://openai.com/gptbot)', 'GPTBot', 'openai'),
        ('Mozilla/5.0 (compatible; OAI-SearchBot/1.4; robots.txt)', 'OAI-SearchBot', 'openai'),
        ('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'AhrefsBot', 'other'),
        ('Mozilla/5.0 (compatible; YandexImages/3.0)', 'YandexImages', 'yandex'),
        ('Mozilla/5.0 (compatible; AdsBot-Google; +http://google.com)', 'AdsBot-Google', 'google'),
        ('Mozilla/5.0 (compatible; YandexWebmaster/2.0)', 'YandexWebmaster', 'yandex'),
    ]

    def test_known_bots(self):
        for ua, name, vendor in self.CASES:
            got = classify_ua(ua)
            self.assertEqual(got, (name, vendor), ua)

    def test_humans_are_none(self):
        for ua in (
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Chrome',
            'Mozilla/5.0 (Linux; Android 14) Mobile Safari',
            None,
            '-',
            '',
        ):
            self.assertIsNone(classify_ua(ua), repr(ua))

    def test_unknown_bot_generic_fallback(self):
        got = classify_ua('SeoQuakeBot/2.0 Mozilla/5.0')
        self.assertIsNotNone(got)
        self.assertEqual(got[1], 'other')
        self.assertIn('SeoQuakeBot', got[0])

    def test_case_insensitive(self):
        got = classify_ua('mozilla/5.0 (compatible; yandexbot/3.0)')
        self.assertEqual(got, ('YandexBot', 'yandex'))


class TestMaskIp(unittest.TestCase):
    def test_ipv4_last_octet_zeroed(self):
        self.assertEqual(mask_ip('77.88.8.8'), '77.88.8.0')
        self.assertEqual(mask_ip('1.2.3.4'), '1.2.3.0')

    def test_ipv6_to_64(self):
        self.assertEqual(mask_ip('2a00:1372:1111:2222:3333:4444:5555:6666'),
                         '2a00:1372:1111:2222::')

    def test_invalid_and_empty(self):
        self.assertIsNone(mask_ip('unknown'))
        self.assertIsNone(mask_ip('-'))
        self.assertIsNone(mask_ip(None))
        self.assertIsNone(mask_ip(''))


class TestDeterministicId(unittest.TestCase):
    def test_same_line_same_id(self):
        from datetime import datetime
        ts = datetime(2026, 11, 11, 9, 45, 6)
        a = make_id(ts, '5.255.253.17', 'GET', '/?yclid=1', 'UA-Yandex')
        b = make_id(ts, '5.255.253.17', 'GET', '/?yclid=1', 'UA-Yandex')
        self.assertEqual(a, b)

    def test_different_ip_different_id(self):
        from datetime import datetime
        ts = datetime(2026, 11, 11, 9, 45, 6)
        a = make_id(ts, '5.255.253.17', 'GET', '/', 'UA')
        b = make_id(ts, '5.255.253.99', 'GET', '/', 'UA')
        self.assertNotEqual(a, b)


class TestSql(unittest.TestCase):
    def test_sql_str_escaping(self):
        self.assertEqual(sql_str("it's"), "'it''s'")
        self.assertEqual(sql_str(None), 'NULL')

    def test_build_insert_on_conflict_and_values(self):
        row = parse_line(LINE_YANDEX_BOT)
        row['botName'], row['vendor'] = classify_ua(row['userAgent'])
        sql = build_insert([row])
        self.assertIn('ON CONFLICT ("id") DO NOTHING', sql)
        self.assertIn('"botName"', sql)
        self.assertIn("'YandexBot'", sql)
        self.assertIn("'yandex'", sql)


class TestCollectBots(unittest.TestCase):
    def test_only_bots_collected_and_deduped(self):
        lines = [
            LINE_YANDEX_METRIKA,
            LINE_YANDEX_METRIKA,  # дубль → отсекается по id
            LINE_HUMAN_IPHONE,    # человек → пропускается
            LINE_GOOGLEBOT_IMAGE,
            LINE_GPTBOT,
            'broken line',        # битая → warn, не падает
        ]
        rows = collect_bots(lines, 'test-source')
        self.assertEqual(len(rows), 3)
        names = sorted(r['botName'] for r in rows)
        self.assertEqual(names, ['GPTBot', 'Googlebot-Image', 'YandexMetrika'])
        vendors = sorted({r['vendor'] for r in rows})
        self.assertEqual(vendors, ['google', 'openai', 'yandex'])

    def test_all_prod_bots_classified(self):
        rows = collect_bots([
            LINE_YANDEX_METRIKA, LINE_YANDEX_BOT, LINE_GOOGLEBOT_IMAGE,
            LINE_GOOGLEBOT_MOBILE, LINE_GPTBOT,
        ], 'test')
        self.assertEqual(len(rows), 5)


class TestDbCredentials(unittest.TestCase):
    def test_env_parsing(self):
        with tempfile.NamedTemporaryFile('w', suffix='.env', delete=False) as fh:
            fh.write('POSTGRES_USER=evak\nPOSTGRES_DB=tow_truck\nOTHER=x\n')
            path = fh.name
        try:
            self.assertEqual(db_credentials(path), ('evak', 'tow_truck'))
        finally:
            os.unlink(path)

    def test_missing_env_defaults(self):
        self.assertEqual(db_credentials('/nonexistent/.env'), ('postgres', 'tow_truck'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
