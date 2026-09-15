import type { ServiceType } from '@/types';
import type { ServicePageConfig, ServicePagePrice } from '@/types/service-page';
import { getServiceBySlug } from '@/config/services';
import { minBaseFee } from '@/config/pricing';
import { formatPrice, formatPricing } from '@/lib/utils';

// РЕЕСТР посадочных SEO-страниц (ЧТЗ_SEO_Рост_позиций_Вебмастер §4, ЭПИК-2).
// Единственный источник для: роутинга (services)/[slug], sitemap, перелинковки.
// Новая страница = новый конфиг-файл + запись в servicePages ниже.

import { evakuator24Page } from './evakuator-24-7';
import { posleDtpPage } from './posle-dtp';
import { sLebedkojPage } from './s-lebedkoj';
import { mototehnikiPage } from './mototehniki';
import { zablokirovannyeKolesaPage } from './zablokirovannyh-koles';
import { vidnoePage } from './vidnoe';
import { legkovyhPage } from './legkovyh';
import { specTehnikiPage } from './spec-tehniki';
import { elektromobilPage } from './elektromobilya';
import { pyatiTonnPage } from './pyati-tonn';
import { podzemnyjParkingPage } from './podzemnyj-parking';
import { nochnojEvakuatorPage } from './nochnoj-evakuator';
import { mezhgorodPage } from './mezhgorod';
import { dzhipSLebedkojPage } from './dzhip-s-lebedkoj';
import { cenyPage } from './ceny';
import { sravnenieEvakuatorovPage } from './sravnenie-evakuatorov-moskva';

export const servicePages: ServicePageConfig[] = [
  evakuator24Page,
  posleDtpPage,
  sLebedkojPage,
  mototehnikiPage,
  zablokirovannyeKolesaPage,
  vidnoePage,
  legkovyhPage,
  specTehnikiPage,
  elektromobilPage,
  pyatiTonnPage,
  podzemnyjParkingPage,
  nochnojEvakuatorPage,
  mezhgorodPage,
  dzhipSLebedkojPage,
  cenyPage,
  sravnenieEvakuatorovPage,
];

export const getServicePage = (slug: string): ServicePageConfig | undefined =>
  servicePages.find((p) => p.slug === slug);

export const servicePageSlugs = (): string[] => servicePages.map((p) => p.slug);

// Перелинковка (ЭПИК-4): карточка услуги из каталога на главной → посадочная страница.
// Если у услуги нет посадочной — карточка ведёт на форму, как раньше.
export const catalogServiceToLanding: Partial<Record<ServiceType, string>> = {
  light_vehicle: 'evakuator-legkovyh',
  moto: 'evakuaciya-mototehniki',
  accident: 'evakuator-posle-dtp',
  offroad: 'evakuator-dzhip-s-lebedkoj',
  commercial: 'evakuaciya-spec-tehniki',
};

/** Человекочитаемая цена для посадочной — из единого источника (без хардкода). */
export function servicePagePriceLabel(price: ServicePagePrice): string {
  switch (price.kind) {
    case 'tariff': {
      const service = getServiceBySlug(price.serviceSlug);
      if (!service || service.pricing.kind !== 'tariff') {
        return `от ${formatPrice(minBaseFee())}`;
      }
      return formatPricing(service.pricing);
    }
    case 'fromMin':
      return `от ${formatPrice(minBaseFee())}`;
    case 'onRequest':
      return 'Цена по запросу';
  }
}
