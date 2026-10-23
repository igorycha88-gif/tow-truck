// Аудит-скрипт гео-страниц (ЧТЗ_Яндекс_SEO_доработка_2026-10, TASK-Я-03, шаг 1):
// npx tsx scripts/seo-geo-audit.ts > geo-audit.csv
// Вывод — CSV по 107 гео-страницам: объём, доля уникального, глубина от главной.
// Используется вместе с Wordstat (шаг 2) и Метрикой (шаг 3) для отбора волны
// доработки «малоценных» страниц (Алгоритм 5 SKILL_SEO.md).

import { geoDirections } from '@/config/geo';
import { geoAuditRows, geoAuditCsv } from '@/lib/seo/geo-audit';

const rows = geoAuditRows(geoDirections);

// Сортировка: кандидаты в волну (низкая доля уникального) — сверху.
rows.sort((a, b) => a.uniqueSharePercent - b.uniqueSharePercent);

process.stdout.write(geoAuditCsv(rows) + '\n');
