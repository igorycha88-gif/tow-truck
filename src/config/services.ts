import type { ServiceCatalogItem } from '@/types';

// Каталог услуг (контент из config, без админки — см. ARCHITECTURE.md §4).
// priceFrom — «от», в рублях. Заглушки, заменить на реальные тарифы.

export const services: ServiceCatalogItem[] = [
  {
    slug: 'light_vehicle',
    title: 'Эвакуация легковых авто',
    description:
      'Эвакуатор для легковых автомобилей любых марок. Аккуратная погрузка, аккуратный транспорт.',
    priceFrom: 3000,
    icon: 'Car',
  },
  {
    slug: 'moto',
    title: 'Эвакуация мотоциклов',
    description:
      'Перевозка мотоциклов, скутеров, квадроциклов с креплением и мягкими ремнями.',
    priceFrom: 2500,
    icon: 'Bike',
  },
  {
    slug: 'commercial',
    title: 'Эвакуация спецтехники',
    description:
      'Эвакуатор для грузовиков, автобусов и коммерческого транспорта. Усиленная платформа.',
    priceFrom: 6000,
    icon: 'Truck',
  },
  {
    slug: 'offroad',
    title: 'Внедорожники и кроссоверы',
    description:
      'Эвакуация внедорожников и авто с низким клиренсом — лебёдка и сдвижная платформа.',
    priceFrom: 3500,
    icon: 'CarFront',
  },
  {
    slug: 'accident',
    title: 'После ДТП',
    description:
      'Эвакуация авто после аварии. Аккуратная работа с повреждённым транспортом, помощь с погрузкой.',
    priceFrom: 4000,
    icon: 'Siren',
  },
];

export const getServiceBySlug = (slug: string) =>
  services.find((s) => s.slug === slug);
