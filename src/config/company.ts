import type { CompanyInfo } from '@/types';

// Контактные данные компании. Значения по умолчанию — реальные.
// См. .env.example (NEXT_PUBLIC_PHONE, NEXT_PUBLIC_EMAIL, NEXT_PUBLIC_WHATSAPP, NEXT_PUBLIC_TELEGRAM).

const phoneDigits = (process.env.NEXT_PUBLIC_PHONE || '+7 (901) 705-45-40');
const phoneHref = `tel:${phoneDigits.replace(/[^+\d]/g, '')}`;
// Email необязателен: личная почта не должна светиться на сайте по умолчанию.
// Публичный email задаётся через NEXT_PUBLIC_EMAIL (см. .env.example).
const email = process.env.NEXT_PUBLIC_EMAIL || undefined;
const emailHref = email ? `mailto:${email}` : undefined;

export const company: CompanyInfo = {
  name: 'Эвакуация Москва и МО',
  phone: phoneDigits,
  phoneHref,
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || undefined,
  telegram: process.env.NEXT_PUBLIC_TELEGRAM || undefined,
  email,
  emailHref,
  address: 'Москва и Московская область',
  workingHours: 'Круглосуточно, 24/7 без выходных',
  domain: 'эвакуация.online',
};

// Операционные показатели (EV-T10: недостоверные «заглушки» — рейтинг, лет на
// рынке, выполнено заказов — УБРАНЫ до подтверждения владельцем; вернуться с
// реальными данными и ссылкой на источник рейтинга, см. ЧТЗ EV-T10).
export const trustStats = {
  responseMinutes: '15–30',
} as const;
