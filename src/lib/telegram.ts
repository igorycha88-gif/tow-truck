import { logger } from '@/lib/logger';

// Отправка уведомления оператору через Telegram Bot API (прямой fetch).
// Graceful: если токен не настроен — логируем и возвращаем false, не падая.
// См. ARCHITECTURE.md §3 (поток заявки), .env.example (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).

export type TelegramMessage = {
  text: string;
  parseMode?: 'HTML' | 'Markdown';
};

export type SendResult = { ok: boolean; reason?: string };

const API_BASE = 'https://api.telegram.org';

export async function sendTelegramMessage(msg: TelegramMessage): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    logger.warn('Telegram not configured, skipping notification', {
      operation: 'telegram.skip',
    });
    return { ok: false, reason: 'NOT_CONFIGURED' };
  }

  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg.text,
        parse_mode: msg.parseMode || 'HTML',
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('Telegram API error', {
        operation: 'telegram.send',
        status: res.status,
        error: body,
      });
      return { ok: false, reason: `HTTP_${res.status}` };
    }

    logger.info('Telegram message sent', { operation: 'telegram.send' });
    return { ok: true };
  } catch (err) {
    logger.error('Telegram send failed', {
      operation: 'telegram.send',
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: 'NETWORK_ERROR' };
  }
}
