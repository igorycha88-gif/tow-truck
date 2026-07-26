import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parsePhoneNumber } from 'libphonenumber-js';
import type { NextRequest } from 'next/server';

// Объединение Tailwind-классов без конфликтов (shadcn pattern).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Человекочитаемый формат цены в рублях: 3000 → "3 000 ₽"
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

// Валидный ли российский телефон.
export function isValidRuPhone(phone: string): boolean {
  try {
    const parsed = parsePhoneNumber(phone, 'RU');
    return Boolean(parsed?.isValid() && parsed.country === 'RU');
  } catch {
    return false;
  }
}

// Нормализация телефона в E.164: "+7 (999) 123-45-67" → "+79991234567".
export function normalizePhone(phone: string): string {
  try {
    const parsed = parsePhoneNumber(phone, 'RU');
    return parsed?.number || phone.replace(/[^+\d]/g, '');
  } catch {
    return phone.replace(/[^+\d]/g, '');
  }
}

// Форматирование телефона для отображения: "+79991234567" → "+7 (999) 123-45-67".
export function formatPhone(phone: string): string {
  try {
    const parsed = parsePhoneNumber(phone, 'RU');
    if (parsed?.isValid()) {
      return parsed.formatInternational();
    }
  } catch {
    /* ignore */
  }
  return phone;
}

// Извлечение IP клиента из запроса (учитывая прокси: X-Forwarded-For, X-Real-IP).
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0]?.trim() || 'unknown';
  }
  const xReal = req.headers.get('x-real-ip');
  if (xReal) return xReal.trim();
  return 'unknown';
}

// Пауза (utility для тестов/фолбэков).
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
