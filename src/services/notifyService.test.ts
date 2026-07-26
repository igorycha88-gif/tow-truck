import { describe, it, expect, beforeEach, vi } from 'vitest';

const { sendTelegramMessage, loggerMock } = vi.hoisted(() => ({
  sendTelegramMessage: vi.fn(),
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage,
}));

vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import { notifyService } from '@/services/notifyService';

describe('notifyService.notifyNewOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('доставляет через Telegram при успехе (happy path)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    const r = await notifyService.notifyNewOrder({
      orderId: 'ord-1',
      name: 'Иван',
      phone: '+79991234567',
      location: 'МКАД',
      serviceType: 'light_vehicle',
      consent: true,
    });
    expect(r.delivered).toBe(true);
    expect(r.channel).toBe('telegram');
    expect(sendTelegramMessage).toHaveBeenCalledOnce();
  });

  it('возвращается not delivered когда все каналы не настроены (error case)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: false, reason: 'NOT_CONFIGURED' });
    const r = await notifyService.notifyNewOrder({
      orderId: 'ord-2',
      name: 'Иван',
      phone: '+79991234567',
      location: 'МКАД',
      serviceType: 'moto',
      consent: true,
    });
    expect(r.delivered).toBe(false);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'All notification channels failed',
      expect.objectContaining({ orderId: 'ord-2' }),
    );
  });

  it('экранирует HTML в полях (edge case)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    await notifyService.notifyNewOrder({
      orderId: 'ord-3',
      name: '<script>alert(1)</script>',
      phone: '+79991234567',
      location: '<b>addr</b>',
      serviceType: 'accident',
      consent: true,
    });
    const call = sendTelegramMessage.mock.calls[0][0];
    expect(call.text).not.toContain('<script>alert(1)</script>');
    expect(call.text).toContain('&lt;script&gt;');
  });

  it('логирует начало операции (тест логирования)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    await notifyService.notifyNewOrder({
      orderId: 'ord-4',
      name: 'Иван',
      phone: '+79991234567',
      location: 'МКАД',
      serviceType: 'fuel',
      consent: true,
    });
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Notifying operator',
      expect.objectContaining({ operation: 'notifyService.notifyNewOrder' }),
    );
  });
});
