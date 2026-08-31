import { describe, it, expect, beforeEach, vi } from 'vitest';

const { sendTelegramMessage, sendOrderEmail, loggerMock } = vi.hoisted(() => ({
  sendTelegramMessage: vi.fn(),
  sendOrderEmail: vi.fn(),
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

vi.mock('@/lib/mailer', () => ({
  sendOrderEmail,
}));

vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import { notifyService } from '@/services/notifyService';

const order = {
  orderId: 'ord-1',
  name: 'Иван',
  phone: '+79991234567',
  location: 'МКАД',
  serviceType: 'light_vehicle',
  consent: true,
} as const;

describe('notifyService.notifyNewOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('доставляет через оба канала параллельно (happy path)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    sendOrderEmail.mockResolvedValue({ ok: true });
    const r = await notifyService.notifyNewOrder({ ...order });
    expect(r).toEqual({ delivered: true, channel: 'telegram+email' });
    expect(sendTelegramMessage).toHaveBeenCalledOnce();
    expect(sendOrderEmail).toHaveBeenCalledOnce();
  });

  it('email уходит даже при сбое Telegram (фолбэк-независимость)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: false, reason: 'NOT_CONFIGURED' });
    sendOrderEmail.mockResolvedValue({ ok: true });
    const r = await notifyService.notifyNewOrder({ ...order });
    expect(r).toEqual({ delivered: true, channel: 'email' });
  });

  it('Telegram работает при сбое email', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    sendOrderEmail.mockResolvedValue({ ok: false, reason: 'SMTP_ERROR' });
    const r = await notifyService.notifyNewOrder({ ...order });
    expect(r).toEqual({ delivered: true, channel: 'telegram' });
  });

  it('возвращается not delivered когда все каналы не настроены (error case)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: false, reason: 'NOT_CONFIGURED' });
    sendOrderEmail.mockResolvedValue({ ok: false, reason: 'NOT_CONFIGURED' });
    const r = await notifyService.notifyNewOrder({ ...order, orderId: 'ord-2' });
    expect(r.delivered).toBe(false);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'All notification channels failed',
      expect.objectContaining({ orderId: 'ord-2' }),
    );
  });

  it('экранирует HTML в полях Telegram (edge case)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    sendOrderEmail.mockResolvedValue({ ok: true });
    await notifyService.notifyNewOrder({
      ...order,
      orderId: 'ord-3',
      name: '<script>alert(1)</script>',
      location: '<b>addr</b>',
    });
    const call = sendTelegramMessage.mock.calls[0][0];
    expect(call.text).not.toContain('<script>alert(1)</script>');
    expect(call.text).toContain('&lt;script&gt;');
  });

  it('включает читаемый номер в Telegram-текст (номер заявки, ADR-013)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    sendOrderEmail.mockResolvedValue({ ok: true });
    await notifyService.notifyNewOrder({ ...order, number: '20260831-5' });
    const call = sendTelegramMessage.mock.calls[0][0];
    expect(call.text).toContain('№20260831-5');
    expect(sendOrderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ number: '20260831-5' }),
    );
  });

  it('работает без номера (edge case, обратная совместимость)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    sendOrderEmail.mockResolvedValue({ ok: true });
    const r = await notifyService.notifyNewOrder({ ...order });
    expect(r.delivered).toBe(true);
    expect(sendTelegramMessage.mock.calls[0][0].text).not.toContain('Номер:');
  });

  it('логирует начало операции (тест логирования)', async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    sendOrderEmail.mockResolvedValue({ ok: true });
    await notifyService.notifyNewOrder({ ...order, orderId: 'ord-4' });
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Notifying operator',
      expect.objectContaining({ operation: 'notifyService.notifyNewOrder' }),
    );
  });
});
