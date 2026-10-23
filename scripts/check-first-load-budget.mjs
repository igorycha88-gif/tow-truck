#!/usr/bin/env node
// Бюджет First Load JS ≤ 120 КБ для '/' и посадочных (ЧТЗ_SEO_Техническая_
// корректировка 2026-10, TASK-EV-T14). Запускается ПОСЛЕ `next build` (CI/dev):
// читает .next/app-build-manifest.json и суммирует размеры файлов страниц.
// Выход ≠ 0 — бюджет превышен.

import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const NEXT_DIR = join(process.cwd(), '.next');
const MANIFEST = join(NEXT_DIR, 'app-build-manifest.json');
const BUDGET_BYTES = 120 * 1024;

// Страницы под бюджетом: главная + шаблон посадочной (все посадочные идентичны
// по чанкам — один динамический сегмент (services)/[slug]).
const PAGES = ['/', '/evakuator-24-7'];
const MANIFEST_KEYS = { '/': '/page', '/evakuator-24-7': '/(services)/[slug]/page' };

if (!existsSync(MANIFEST)) {
  console.error('✗ .next/app-build-manifest.json не найден — сначала выполните `next build`');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const sizeOf = (file) => statSync(join(NEXT_DIR, file)).size;

let failed = false;
for (const page of PAGES) {
  const files = manifest.pages[MANIFEST_KEYS[page] ?? page];
  if (!files) {
    console.error(`✗ ${page}: нет в app-build-manifest.json`);
    failed = true;
    continue;
  }
  const total = files.reduce((sum, f) => sum + sizeOf(f), 0);
  const kb = (total / 1024).toFixed(1);
  const ok = total <= BUDGET_BYTES;
  console.log(`${ok ? '✓' : '✗'} ${page}: First Load JS ≈ ${kb} КБ (бюджет 120 КБ)`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('Бюджет First Load JS превышен — оптимизируйте клиентские бандлы');
  process.exit(1);
}
console.log('Бюджет First Load JS соблюдён для всех проверенных страниц');
