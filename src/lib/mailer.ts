import { logger } from '@/lib/logger';
import { formatPhone } from '@/lib/utils';
import { services } from '@/config/services';
import type { OrderSchemaInput } from '@/lib/validators/order';

// Отправка заявки на почту операторам через SMTP Яндекса (Nodemailer).
// Получатели — список NOTIFY_EMAIL через запятую (ЧТЗ_Email_уведомления_Яндекс_SMTP.md).
// Graceful: SMTP не настроен или ошибка отправки — НЕ роняет создание заявки.

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  recipients: string[];
};

export type MailerResult = { ok: boolean; reason?: string };

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || user;
  const rawTo = process.env.NOTIFY_EMAIL;

  if (!host || !user || !pass || !from || !rawTo) {
    return null;
  }

  const recipients = rawTo
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);

  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from,
    recipients,
  };
}

export async function sendOrderEmail(
  order: OrderSchemaInput & { orderId: string; number?: string | null },
): Promise<MailerResult> {
  const config = getSmtpConfig();

  if (!config) {
    logger.warn('SMTP not configured, skipping email', {
      operation: 'mailer.skip',
    });
    return { ok: false, reason: 'NOT_CONFIGURED' };
  }

  const { orderId, number, name, phone, location, serviceType } = order;
  const service = services.find((s) => s.slug === serviceType);
  const serviceTitle = service?.title ?? serviceType;
  const numberLine = number ? `Номер: №${number}` : `ID: ${orderId}`;

  const subject = number
    ? `Новая заявка на эвакуацию №${number}`
    : `Новая заявка на эвакуацию #${orderId}`;
  const text =
    `Новая заявка на эвакуацию\n\n` +
    `${numberLine}\n` +
    `Имя: ${name}\n` +
    `Телефон: ${formatPhone(phone)}\n` +
    `Адрес: ${location}\n` +
    `Услуга: ${serviceTitle}\n` +
    `ID: ${orderId}`;
  const html =
    `<h2>🚨 Новая заявка на эвакуацию</h2>` +
    (number ? `<p><b>Номер:</b> №${escapeHtml(number)}</p>` : '') +
    `<p><b>Имя:</b> ${escapeHtml(name)}<br>` +
    `<b>Телефон:</b> ${escapeHtml(formatPhone(phone))}<br>` +
    `<b>Адрес:</b> ${escapeHtml(location)}<br>` +
    `<b>Услуга:</b> ${escapeHtml(serviceTitle)}<br>` +
    `<b>ID:</b> ${escapeHtml(orderId)}</p>`;

  logger.info('Sending order email', {
    operation: 'mailer.send',
    orderId,
    number,
    recipients: config.recipients.length,
  });

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.sendMail({
      from: config.from,
      to: config.recipients.join(', '),
      subject,
      text,
      html,
    });

    logger.info('Order email sent', {
      operation: 'mailer.send',
      orderId,
      number,
      recipients: config.recipients.length,
    });
    return { ok: true };
  } catch (err) {
    logger.error('Order email failed', {
      operation: 'mailer.send',
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: 'SMTP_ERROR' };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
