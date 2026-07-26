// Единый источник истины для настроек сайта (читается из ENV, см. .env.example)

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'Эвакуация Москва и МО',
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000',
  description:
    'Эвакуатор 24/7 в Москве и Московской области. Подача 15–30 минут, своя техника, ' +
    'фиксированные цены. Эвакуация легковых, мото, спецтехники, внедорожников, после ДТП. ' +
    'Звоните прямо сейчас.',
  locale: 'ru_RU',
  ogImage: '/og.png',
} as const;

export const navigation = [
  { label: 'Услуги', href: '/#services' },
  { label: 'Преимущества', href: '/#advantages' },
  { label: 'Как мы работаем', href: '/#process' },
  { label: 'Заказать', href: '/#order' },
  { label: 'Контакты', href: '/#contacts' },
] as const;
