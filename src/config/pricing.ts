import { formatPrice } from '@/lib/utils';

// ЕДИНЫЙ ИСТОЧНИК ЦЕН (ЧТЗ_SEO_Рост_позиций_Вебмастер §1.2, ЧТЗ_Обновление_цен §2).
// Цены утверждены заказчиком 2026-07-26. Изменение цен — ТОЛЬКО здесь:
// мета-теги, JSON-LD priceRange, посадочные страницы и каталог услуг берут значения отсюда.

export const tariffs = {
  lightVehicle: { baseFee: 5000, perKm: 100 },
  moto: { baseFee: 5000, perKm: 100 },
  offroad: { baseFee: 6000, perKm: 100 },
} as const;

// Ночная эвакуация: надбавка к дневному тарифу (решение владельца 23.10.2026:
// ночь = тариф +30%). ЕДИНЫЙ источник — тексты посадочных берут значение отсюда.
export const nightSurchargePercent = 30;

/** «+30%» — формулировка ночного тарифа для текстов посадочных. */
export const nightTariffLabel = (): string => `+${nightSurchargePercent}%`;

// Минимальная подача среди тарифов — для формулировки «от N ₽» в мета-тегах.
export const minBaseFee = (): number =>
  Math.min(...Object.values(tariffs).map((t) => t.baseFee));

// Минимальная стоимость километра (для текстов «далее N ₽ за километр»).
export const minPerKm = (): number =>
  Math.min(...Object.values(tariffs).map((t) => t.perKm));

// «от 5 000 ₽» — для title/description/priceRange (синхронизация мета и контента).
export const priceFromLabel = (): string => `от ${formatPrice(minBaseFee())}`;

// «100 ₽» — цена километра для текстов посадочных.
export const perKmLabel = (): string => formatPrice(minPerKm());

// priceRange для JSON-LD LocalBusiness (см. json-ld.ts).
export const priceRangeLabel = (): string => priceFromLabel();
