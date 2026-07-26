import { sendTelegramMessage } from '@/lib/telegram';
import { logger } from '@/lib/logger';
import { formatPhone } from '@/lib/utils';
import { services } from '@/config/services';
import type { OrderSchemaInput } from '@/lib/validators/order';

// Доставка уведомлений оператору о новой заявке (см. ARCHITECTURE.md §3).
// Канал 1: Telegram (основной). Канал 2: email-резерв (Nodemailer) при сбое TG.
// Fire-and-forget: ошибка отправки НЕ должна ронять создание заявки.

type NotifyOrderParams = OrderSchemaInput & { orderId: string };

export const notifyService = {
  async notifyNewOrder(order: NotifyOrderParams): Promise<{ delivered: boolean; channel: string | null }> {
    const { orderId, name, phone, location, serviceType } = order;
    const service = services.find((s) => s.slug === serviceType);
    const serviceTitle = service?.title ?? serviceType;

    const text =
      `🚨 <b>Новая заявка на эвакуацию</b>\n\n` +
      `<b>Имя:</b> ${escapeHtml(name)}\n` +
      `<b>Телефон:</b> ${escapeHtml(formatPhone(phone))}\n` +
      `<b>Адрес:</b> ${escapeHtml(location)}\n` +
      `<b>Услуга:</b> ${escapeHtml(serviceTitle)}\n` +
      `<b>ID:</b> <code>${orderId}</code>`;

    logger.info('Notifying operator', {
      operation: 'notifyService.notifyNewOrder',
      orderId,
    });

    const tg = await sendTelegramMessage({ text, parseMode: 'HTML' });
    if (tg.ok) {
      return { delivered: true, channel: 'telegram' };
    }

    // Фолбэк: email (если настроен SMTP)
    const emailResult = await sendEmailFallback(orderId, text);
    if (emailResult) {
      return { delivered: true, channel: 'email' };
    }

    logger.warn('All notification channels failed', {
      operation: 'notifyService.notifyNewOrder',
      orderId,
      reason: tg.reason,
    });
    return { delivered: false, channel: null };
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Email-резерв через Nodemailer (динамический импорт, чтобы не тащить в bundle).
async function sendEmailFallback(orderId: string, text: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  const to = process.env.NOTIFY_EMAIL;

  if (!host || !user || !pass || !from || !to) {
    return false;
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to,
      subject: `Новая заявка на эвакуацию #${orderId}`,
      text: text.replace(/<[^>]+>/g, ''),
    });

    logger.info('Email fallback sent', {
      operation: 'notifyService.emailFallback',
      orderId,
    });
    return true;
  } catch (err) {
    logger.error('Email fallback failed', {
      operation: 'notifyService.emailFallback',
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
