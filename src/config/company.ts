import type { CompanyInfo } from '@/types';

// Контактные данные компании. Значения по умолчанию — реальные.
// См. .env.example (NEXT_PUBLIC_PHONE, NEXT_PUBLIC_EMAIL, NEXT_PUBLIC_WHATSAPP, NEXT_PUBLIC_TELEGRAM).

const phoneDigits = (process.env.NEXT_PUBLIC_PHONE || '+7 (901) 705-45-40');
const phoneHref = `tel:${phoneDigits.replace(/[^+\d]/g, '')}`;
const email = (process.env.NEXT_PUBLIC_EMAIL || 'boronind1m@yandex.ru');
const emailHref = `mailto:${email}`;

export const company: CompanyInfo = {
  name: 'Эвакуация Москва и МО',
  legalName: 'ИП Иванов И. И.', // заглушка
  inn: '770000000000', // заглушка
  phone: phoneDigits,
  phoneHref,
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || undefined,
  telegram: process.env.NEXT_PUBLIC_TELEGRAM || undefined,
  email,
  emailHref,
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
