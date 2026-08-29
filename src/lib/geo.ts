import geoip from 'geoip-lite';
import { normalizeIp } from '@/lib/utils';
import { logger } from '@/lib/logger';

// Геолокация посетителей (ЧТЗ §2.3): геобаза MaxMind GeoLite2 (пакет geoip-lite,
// офлайн, без ключей и внешних API). Город пишется в БД при событии трекинга.
// Не определился (приватный/неизвестный IP) → null → в метрике city="(unknown)".
// Кэш IP → город в памяти: визиты одного посетителя не дёргают геобазу повторно.

const CACHE_MAX_ENTRIES = 10_000;
const CITY_MAX_LENGTH = 100;

const cache = new Map<string, string | null>();

export function lookupCity(ip: string | null | undefined): string | null {
  if (!ip || ip === 'unknown') return null;
  const key = normalizeIp(ip);

  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  let city: string | null = null;
  try {
    const geo = geoip.lookup(key);
    if (geo?.city) {
      city = geo.city.slice(0, CITY_MAX_LENGTH);
    }
  } catch (err) {
    logger.error('Geo lookup failed', {
      operation: 'geo.lookupCity',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Простая защита от роста памяти: кэш перезаполняется с нуля.
    cache.clear();
  }
  cache.set(key, city);
  return city;
}

// Тестовый хук: сброс кэша.
export function __resetGeoCache(): void {
  cache.clear();
}
