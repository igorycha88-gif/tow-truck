import { describe, it, expect } from 'vitest';
import { sanitizeSourceLabel, DIRECT_SOURCE } from '@/lib/referer';

describe('sanitizeSourceLabel', () => {
  it('null/undefined/пусто → (direct) (happy path)', () => {
    expect(sanitizeSourceLabel(null)).toBe(DIRECT_SOURCE);
    expect(sanitizeSourceLabel(undefined)).toBe(DIRECT_SOURCE);
    expect(sanitizeSourceLabel('')).toBe(DIRECT_SOURCE);
    expect(sanitizeSourceLabel('   ')).toBe(DIRECT_SOURCE);
  });

  it('метка (direct) проходит как есть', () => {
    expect(sanitizeSourceLabel('(direct)')).toBe(DIRECT_SOURCE);
  });

  it('голый host нормализуется: нижний регистр, без www', () => {
    expect(sanitizeSourceLabel('Yandex.RU')).toBe('yandex.ru');
    expect(sanitizeSourceLabel('www.google.com')).toBe('google.com');
  });

  it('полный URL сводится к host (edge case: клиент прислал URL)', () => {
    expect(sanitizeSourceLabel('https://www.yandex.ru/search/?text=эвакуатор')).toBe('yandex.ru');
    expect(sanitizeSourceLabel('http://go.mail.ru/redir')).toBe('go.mail.ru');
  });

  it('мусор → (direct) (error case)', () => {
    expect(sanitizeSourceLabel('не сайт!!!')).toBe(DIRECT_SOURCE);
    expect(sanitizeSourceLabel('javascript:alert(1)')).toBe(DIRECT_SOURCE);
    expect(sanitizeSourceLabel('http://')).toBe(DIRECT_SOURCE);
  });

  it('обрезается до 100 символов (edge case)', () => {
    const long = 'a'.repeat(150);
    expect(sanitizeSourceLabel(long)).toHaveLength(100);
  });
});
