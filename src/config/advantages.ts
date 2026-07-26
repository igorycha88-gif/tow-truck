import type { AdvantageItem } from '@/types';

// Преимущества компании (контент в config, без админки).

export const advantages: AdvantageItem[] = [
  {
    id: 'around-clock',
    icon: 'Clock',
    title: 'Работаем 24/7',
    text: 'Принимаем заявки и выезжаем круглосуточно, без выходных и праздников.',
  },
  {
    id: 'fast-arrival',
    icon: 'Timer',
    title: 'Подача 15–30 минут',
    text: 'Несколько машин в разных районах Москвы и МО — успеваем быстро.',
  },
  {
    id: 'own-fleet',
    icon: 'Truck',
    title: 'Своя техника',
    text: 'Современные эвакуаторы с лебёдками и сдвижной платформой, аккуратные водители.',
  },
  {
    id: 'fixed-price',
    icon: 'BadgeRussianRuble',
    title: 'Фиксированные цены',
    text: 'Называем стоимость до выезда — без скрытых платежей и доплат «на месте».',
  },
  {
    id: 'experience',
    icon: 'ShieldCheck',
    title: 'Опыт более 8 лет',
    text: 'Тысячи успешных эвакуаций по Москве и области. Юр. лицо, работаем официально.',
  },
  {
    id: 'any-situation',
    icon: 'LifeBuoy',
    title: 'Помощь в любой ситуации',
    text: 'ДТП, поломка, бездорожье — решаем всё под ключ.',
  },
];
