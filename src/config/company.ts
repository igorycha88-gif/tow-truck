import type { CompanyInfo } from '@/types';

// Контактные данные компании. ЗАГЛУШКИ — заменить на реальные одной правкой.
// См. .env.example (NEXT_PUBLIC_PHONE, NEXT_PUBLIC_WHATSAPP, NEXT_PUBLIC_TELEGRAM).

const phoneDigits = (process.env.NEXT_PUBLIC_PHONE || '+7 (495) 000-00-00');
const phoneHref = `tel:${phoneDigits.replace(/[^+\d]/g, '')}`;

export const company: CompanyInfo = {
  name: 'Эвакуация Москва и МО',
  legalName: 'ИП Иванов И. И.', // заглушка
  inn: '770000000000', // заглушка
  phone: phoneDigits,
  phoneHref,
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || undefined,
  telegram: process.env.NEXT_PUBLIC_TELEGRAM || undefined,
  email: process.env.NOTIFY_EMAIL || undefined,
  address: 'Москва и Московская область',
  workingHours: 'Круглосуточно, 24/7 без выходных',
  domain: 'example.ru', // заглушка
};

// Маркетинговые метрики доверия (заглушки — обновить при реальных данных)
export const trustStats = {
  responseMinutes: '15–30',
  experienceYears: 8,
  ordersDone: 5000,
  rating: 4.9,
} as const;
