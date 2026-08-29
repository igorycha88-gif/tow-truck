import { describe, it, expect, beforeEach, vi } from 'vitest';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock('geoip-lite', () => ({ default: { lookup: lookupMock } }));

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import { lookupCity, __resetGeoCache } from '@/lib/geo';

describe('lookupCity (GeoLite2 через geoip-lite)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetGeoCache();
  });

  it('возвращает город для публичного IP (happy path)', () => {
    lookupMock.mockReturnValue({ city: 'Moscow', country: 'RU' });
    expect(lookupCity('77.88.8.8')).toBe('Moscow');
    expect(lookupMock).toHaveBeenCalledWith('77.88.8.8');
  });

  it('нет ip / unknown → null без обращения к геобазе (edge case)', () => {
    expect(lookupCity(null)).toBeNull();
    expect(lookupCity(undefined)).toBeNull();
    expect(lookupCity('unknown')).toBeNull();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('геобаза не нашла город → null', () => {
    lookupMock.mockReturnValue({ city: null, country: 'RU' });
    expect(lookupCity('10.10.10.10')).toBeNull();
  });

  it('кэширует результат: повторный IP не дёргает геобазу', () => {
    lookupMock.mockReturnValue({ city: 'Vidnoye' });
    expect(lookupCity('5.6.7.8')).toBe('Vidnoye');
    expect(lookupCity('5.6.7.8')).toBe('Vidnoye');
    expect(lookupMock).toHaveBeenCalledTimes(1);
  });

  it('IPv6-mapped IPv4 нормализуется и кэшируется тем же ключом', () => {
    lookupMock.mockReturnValue({ city: 'Moscow' });
    expect(lookupCity('::ffff:1.2.3.4')).toBe('Moscow');
    expect(lookupCity('1.2.3.4')).toBe('Moscow');
    expect(lookupMock).toHaveBeenCalledTimes(1);
  });

  it('сбой геобазы → null + logger.error (error case)', () => {
    lookupMock.mockImplementation(() => {
      throw new Error('data corrupted');
    });
    expect(lookupCity('9.9.9.9')).toBeNull();
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Geo lookup failed',
      expect.objectContaining({ operation: 'geo.lookupCity' }),
    );
  });

  it('длинное имя города обрезается до 100 символов (edge case)', () => {
    lookupMock.mockReturnValue({ city: 'x'.repeat(150) });
    expect(lookupCity('4.4.4.4')).toHaveLength(100);
  });
});
