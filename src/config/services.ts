import type { ServiceCatalogItem } from '@/types';
import { tariffs } from '@/config/pricing';

// Каталог услуг (контент из config, без админки — см. ARCHITECTURE.md §4).
// pricing: тариф (подача + ₽/км) или «по запросу» (см. ServicePricing).
// Цифры тарифов — из единого источника src/config/pricing.ts (НЕ хардкодить здесь).

export const services: ServiceCatalogItem[] = [
  {
    slug: 'light_vehicle',
    title: 'Эвакуация легковых авто',
    description:
      'Эвакуатор для легковых автомобилей любых марок. Аккуратная погрузка, аккуратный транспорт.',
    pricing: { kind: 'tariff', ...tariffs.lightVehicle },
    icon: 'Car',
  },
  {
    slug: 'moto',
    title: 'Эвакуация мотоциклов',
    description:
      'Перевозка мотоциклов, скутеров, квадроциклов с креплением и мягкими ремнями.',
    pricing: { kind: 'tariff', ...tariffs.moto },
    icon: 'Bike',
  },
  {
    slug: 'commercial',
    title: 'Эвакуация спецтехники',
    description:
      'Эвакуатор для спецтехники и коммерческого транспорта до 15 тонн. Усиленная платформа, лебёдка.',
    pricing: { kind: 'onRequest' },
    icon: 'Truck',
  },
  {
    slug: 'offroad',
    title: 'Внедорожники и кроссоверы',
    description:
      'Эвакуация внедорожников и авто с низким клиренсом — лебёдка и сдвижная платформа.',
    pricing: { kind: 'tariff', ...tariffs.offroad },
    icon: 'CarFront',
  },
  {
    slug: 'accident',
    title: 'После ДТП',
    description:
      'Эвакуация авто после аварии. Аккуратная работа с повреждённым транспортом, помощь с погрузкой.',
    pricing: { kind: 'onRequest' },
    icon: 'Siren',
  },
];

export const getServiceBySlug = (slug: string) =>
  services.find((s) => s.slug === slug);
