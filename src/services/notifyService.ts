import { sendTelegramMessage } from '@/lib/telegram';
import { sendOrderEmail } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { formatPhone } from '@/lib/utils';
import { services } from '@/config/services';
import type { OrderSchemaInput } from '@/lib/validators/order';

// Доставка уведомлений оператору о новой заявке (см. ARCHITECTURE.md §3).
// Два ПАРАЛЛЕЛЬНЫХ канала: Telegram + email (Яндекс SMTP, все получатели из NOTIFY_EMAIL).
// number — читаемый номер заявки ГГГГММДД-N (ADR-013).
// Fire-and-forget: ошибка отправки НЕ должна ронять создание заявки.

type NotifyOrderParams = OrderSchemaInput & { orderId: string; number?: string | null };

export const notifyService = {
  async notifyNewOrder(order: NotifyOrderParams): Promise<{ delivered: boolean; channel: string | null }> {
    const { orderId, number, name, phone, addressFrom, addressTo, serviceType } = order;
    const service = services.find((s) => s.slug === serviceType);
    const serviceTitle = service?.title ?? serviceType;

    const text =
      `🚨 <b>Новая заявка на эвакуацию</b>\n\n` +
      (number ? `<b>Номер:</b> №${escapeHtml(number)}\n` : '') +
      `<b>Имя:</b> ${escapeHtml(name)}\n` +
      `<b>Телефон:</b> ${escapeHtml(formatPhone(phone))}\n` +
      `<b>Откуда забрать:</b> ${escapeHtml(addressFrom)}\n` +
      (addressTo ? `<b>Куда доставить:</b> ${escapeHtml(addressTo)}\n` : '') +
      `<b>Услуга:</b> ${escapeHtml(serviceTitle)}\n` +
      `<b>ID:</b> <code>${orderId}</code>`;

    logger.info('Notifying operator', {
      operation: 'notifyService.notifyNewOrder',
      orderId,
    });

    const [tg, email] = await Promise.all([
      sendTelegramMessage({ text, parseMode: 'HTML' }),
      sendOrderEmail(order),
    ]);

    const channels = [tg.ok ? 'telegram' : null, email.ok ? 'email' : null].filter(
      (c): c is string => c !== null,
    );

    if (channels.length === 0) {
      logger.warn('All notification channels failed', {
        operation: 'notifyService.notifyNewOrder',
        orderId,
        tgReason: tg.reason,
        emailReason: email.reason,
      });
      return { delivered: false, channel: null };
    }

    return { delivered: true, channel: channels.join('+') };
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
