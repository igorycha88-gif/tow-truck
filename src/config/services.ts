import type { ServiceCatalogItem } from '@/types';

// Каталог услуг (контент из config, без админки — см. ARCHITECTURE.md §4).
// pricing: тариф (подача + ₽/км) или «по запросу» (см. ServicePricing).

export const services: ServiceCatalogItem[] = [
  {
    slug: 'light_vehicle',
    title: 'Эвакуация легковых авто',
    description:
      'Эвакуатор для легковых автомобилей любых марок. Аккуратная погрузка, аккуратный транспорт.',
    pricing: { kind: 'tariff', baseFee: 5000, perKm: 100 },
    icon: 'Car',
  },
  {
    slug: 'moto',
    title: 'Эвакуация мотоциклов',
    description:
      'Перевозка мотоциклов, скутеров, квадроциклов с креплением и мягкими ремнями.',
    pricing: { kind: 'tariff', baseFee: 5000, perKm: 100 },
    icon: 'Bike',
  },
  {
    slug: 'commercial',
    title: 'Эвакуация спецтехники',
    description:
      'Эвакуатор для грузовиков, автобусов и коммерческого транспорта. Усиленная платформа.',
    pricing: { kind: 'onRequest' },
    icon: 'Truck',
  },
  {
    slug: 'offroad',
    title: 'Внедорожники и кроссоверы',
    description:
      'Эвакуация внедорожников и авто с низким клиренсом — лебёдка и сдвижная платформа.',
    pricing: { kind: 'tariff', baseFee: 6000, perKm: 100 },
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
