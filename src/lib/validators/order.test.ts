import { describe, it, expect, beforeEach, vi } from 'vitest';
import { orderSchema } from '@/lib/validators/order';

describe('orderSchema', () => {
  const valid = {
    name: 'Иван',
    phone: '+7 (999) 123-45-67',
    location: 'МКАД 50 км',
    serviceType: 'light_vehicle' as const,
    consent: true as const,
  };

  it('проходит для валидных данных и нормализует телефон (happy path)', () => {
    const res = orderSchema.parse(valid);
    expect(res.phone).toBe('+79991234567');
    expect(res.consent).toBe(true);
  });

  it('отвергает короткое имя', () => {
    const r = orderSchema.safeParse({ ...valid, name: 'И' });
    expect(r.success).toBe(false);
  });

  it('отвергает слишком длинное имя (edge case)', () => {
    const r = orderSchema.safeParse({ ...valid, name: 'а'.repeat(101) });
    expect(r.success).toBe(false);
  });

  it('отвергает невалидный телефон', () => {
    const r = orderSchema.safeParse({ ...valid, phone: '12345' });
    expect(r.success).toBe(false);
  });

  it('отвергает пустую локацию', () => {
    const r = orderSchema.safeParse({ ...valid, location: '' });
    expect(r.success).toBe(false);
  });

  it('отвергает неизвестный serviceType', () => {
    const r = orderSchema.safeParse({ ...valid, serviceType: 'unknown' });
    expect(r.success).toBe(false);
  });

  it('отвергает отсутствие согласия (152-ФЗ)', () => {
    const r = orderSchema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
  });

  it('обрезает пробелы в полях', () => {
    const res = orderSchema.parse({
      ...valid,
      name: '  Иван  ',
      location: '  МКАД  ',
    });
    expect(res.name).toBe('Иван');
    expect(res.location).toBe('МКАД');
  });
});

describe('orderSchema — сообщения об ошибках', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('даёт понятное сообщение для имени', () => {
    const r = orderSchema.safeParse({ name: '', phone: '', location: '', serviceType: 'light_vehicle', consent: true });
    expect(r.success).toBe(false);
    if (!r.success) {
      const nameIssue = r.error.issues.find((i) => i.path[0] === 'name');
      expect(nameIssue?.message).toMatch(/имя/i);
    }
  });
});
