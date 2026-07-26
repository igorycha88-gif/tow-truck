import { describe, it, expect, beforeEach, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { sendTelegramMessage } from '@/lib/telegram';

describe('sendTelegramMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('возвращает NOT_CONFIGURED если нет токена (happy-ish path)', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const r = await sendTelegramMessage({ text: 'hi' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('NOT_CONFIGURED');
  });

  it('отправляет сообщение при HTTP 200 (happy path)', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_CHAT_ID = 'chat';
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const r = await sendTelegramMessage({ text: 'hello' });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('возвращает HTTP-ошибку при не 200 (error case)', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_CHAT_ID = 'chat';
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('bad') });
    const r = await sendTelegramMessage({ text: 'x' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('HTTP_400');
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('обрабатывает сетевую ошибку (edge case)', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_CHAT_ID = 'chat';
    fetchMock.mockRejectedValue(new Error('network down'));
    const r = await sendTelegramMessage({ text: 'x' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('NETWORK_ERROR');
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });
});
