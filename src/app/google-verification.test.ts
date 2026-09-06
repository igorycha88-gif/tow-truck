import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const publicDir = path.join(process.cwd(), 'public');
const googleFile = path.join(publicDir, 'google0f696e1033e85b54.html');

describe('Google Search Console верификация', () => {
  it('файл google0f696e1033e85b54.html существует в public/', () => {
    expect(existsSync(googleFile), 'файл верификации Google отсутствует в public/').toBe(true);
  });

  it('содержимое файла соответствует формату google-site-verification', () => {
    const content = readFileSync(googleFile, 'utf-8').trim();
    expect(content).toBe('google-site-verification: google0f696e1033e85b54.html');
  });

  it('файл яндекс-верификации не затронут (регрессия)', () => {
    expect(existsSync(path.join(publicDir, 'yandex_c6dcbbf42140752b.html'))).toBe(true);
  });
});
