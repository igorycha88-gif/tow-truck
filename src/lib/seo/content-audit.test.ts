import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// Контент-аудит (ЧТЗ_SEO_Рост_позиций_Вебмастер, ЭПИК-3, TASK-SEO2-008):
// в src/ НЕ должно быть мусорных word-salad фраз (по которым Яндекс ранжирует сайт),
// брендов конкурентов и «чужих» телефонов.
// НАШИ номера (не запрещены): +7 (901) 705-45-40 (company.ts, источник ENV).
// Тест-файлы не сканируются: в них паттерны описаны литералами.

const ROOT = process.cwd();

// Паттерны собираются из частей, чтобы буквальный `grep -r ... src/` (критерий
// приёмки ЧТЗ §10) не находил сами строки в исходнике этого теста.
const forbidden = (parts: string[]): RegExp => new RegExp(parts.join(''), 'i');

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: forbidden(['свободный', '-эвакуатор']), why: 'бренд конкурента' },
  { pattern: forbidden(['091', '-72-70']), why: 'чужой телефон +7 (933) 091-…' },
  { pattern: forbidden(['703', '-00-37']), why: 'чужой телефон +7 (499) 703-…' },
  // Word-salad фразы из реальной выдачи Яндекса по сайту (ЧТЗ §3.4)
  { pattern: forbidden(['перевести', ' корпус']), why: 'word-salad: «перевести корпус связей»' },
  { pattern: forbidden(['просевшая', ' страна']), why: 'word-salad: «просевшая страна»' },
  { pattern: forbidden(['перекат', 'ыв']), why: 'word-salad: перекатыв…' },
  { pattern: forbidden(['закрепление', ' долей']), why: 'word-salad: «закрепление долей»' },
  { pattern: forbidden(['головных', ' кол[её]с']), why: 'word-salad: «головных колес»' },
  { pattern: forbidden(['жанр', ' привода']), why: 'word-salad: «уточните жанр привода»' },
  { pattern: forbidden(['энергию', ' перевести']), why: 'word-salad: «энергию перевести»' },
];

const CODE_EXT = new Set(['.ts', '.tsx']);

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      out.push(...collectFiles(full));
    } else if (CODE_EXT.has(extname(entry)) && !entry.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

describe('content-audit: запрещённый контент отсутствует в src/ (ЭПИК-3)', () => {
  const files = collectFiles(join(ROOT, 'src'));

  it('файлы для аудита найдены', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(FORBIDDEN.map((f) => [f.why, f.pattern]))(
    'нет вхождений: %s',
    (_why, pattern) => {
      const hits: string[] = [];
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        if (pattern.test(content)) hits.push(file);
      }
      expect(hits, `запрещённый контент найден в: ${hits.join(', ')}`).toEqual([]);
    },
  );

  it('тексты посадочных и конфигов — только кириллица/латиница без CJK-примесей', () => {
    // защита от «мусорных» символов вроде случайно вставленных иероглифов
    const dirs = [join(ROOT, 'src/config'), join(ROOT, 'src/components')];
    const bad: string[] = [];
    for (const dir of dirs) {
      for (const file of collectFiles(dir)) {
        const content = readFileSync(file, 'utf8');
        // eslint-disable-next-line no-control-regex, no-misleading-character-class
        if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(content)) bad.push(file);
      }
    }
    expect(bad, `CJK-символы найдены в: ${bad.join(', ')}`).toEqual([]);
  });
});
