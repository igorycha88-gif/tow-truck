import type { ProcessStep } from '@/types';

// Схема работы: 1 → 2 → 3 → 4 (контент в config, без админки).

export const processSteps: ProcessStep[] = [
  {
    step: 1,
    title: 'Звонок или заявка',
    text: 'Звоните или оставьте заявку на сайте. Уточняем адрес и тип услуги.',
    icon: 'PhoneCall',
  },
  {
    step: 2,
    title: 'Подача эвакуатора',
    text: 'Принимаем заказ и выезжаем. Подача в течение 15–30 минут.',
    icon: 'Truck',
  },
  {
    step: 3,
    title: 'Погрузка и перевозка',
    text: 'Аккуратно грузим авто и доставляем по указанному адресу.',
    icon: 'PackageCheck',
  },
  {
    step: 4,
    title: 'Оплата',
    text: 'Оплата по факту. Наличные, перевод или безнал для юр. лиц.',
    icon: 'Wallet',
  },
];
