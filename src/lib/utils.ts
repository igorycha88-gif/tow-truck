import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parsePhoneNumber } from 'libphonenumber-js';
import type { NextRequest } from 'next/server';
import type { ServicePricing } from '@/types';

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

// Человекочитаемый формат модели цены услуги.
// tariff  → "Подача 5 000 ₽ • 100 ₽/км"
// onRequest → "Цена по запросу"
export function formatPricing(pricing: ServicePricing): string {
  if (pricing.kind === 'onRequest') {
    return 'Цена по запросу';
  }
  return `Подача ${formatPrice(pricing.baseFee)} • ${formatPrice(pricing.perKm)}/км`;
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
// IPv6-mapped IPv4 (::ffff:1.2.3.4) нормализуется в чистый IPv4 (ADR-002).
export function getClientIp(req: NextRequest): string {
  const raw = readClientIp(req);
  return normalizeIp(raw);
}

function readClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0]?.trim() || 'unknown';
  }
  const xReal = req.headers.get('x-real-ip');
  if (xReal) return xReal.trim();
  return 'unknown';
}

// Нормализация IP: убирает IPv6-mapped префикс (::ffff:1.2.3.4 → 1.2.3.4).
export function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:') && ip.includes('.')) {
    return ip.slice('::ffff:'.length);
  }
  return ip;
}

// Маскирование IP перед записью в БД (152-ФЗ, минимизация: даже
// консервативная трактовка «IP = ПДн» снимается — идентифицировать
// абонента по маске невозможно, см. ЧТЗ_152ФЗ_маскирование_IP_и_политика).
//   IPv4: 77.88.8.8 → 77.88.8.0   (последний октет → 0)
//   IPv6: 2a00:1372:1111:2222:… → 2a00:1372:1111:2222::  (/64)
// ::ffff:-mapped сначала нормализуется. 'unknown'/мусор — как есть.
// Полный IP нужен только в рамках запроса: rate-limit и гео-lookup.
export function maskIp(ip: string): string {
  const normalized = normalizeIp(ip);

  if (normalized.includes('.')) {
    const parts = normalized.split('.');
    if (parts.length !== 4) return normalized;
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  if (normalized.includes(':')) {
    return maskIpv6To64(normalized);
  }

  return normalized;
}

// /64-префикс IPv6 с корректным расширением сжатой формы '::'
// (2001:db8::1 → 2001:db8:0:0::). Идемпотентно для уже маскированных адресов.
function maskIpv6To64(ip: string): string {
  const doubleColon = ip.indexOf('::');
  let groups: string[];
  if (doubleColon === -1) {
    groups = ip.split(':');
  } else {
    const head = ip.slice(0, doubleColon);
    const tail = ip.slice(doubleColon + 2);
    const headGroups = head ? head.split(':') : [];
    const tailGroups = tail ? tail.split(':') : [];
    const missing = 8 - headGroups.length - tailGroups.length;
    groups = [...headGroups, ...Array.from({ length: Math.max(missing, 0) }, () => '0'), ...tailGroups];
  }
  return `${groups.slice(0, 4).map((g) => g.toLowerCase()).join(':')}::`;
}

// Пауза (utility для тестов/фолбэков).
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
