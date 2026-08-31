import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { createTransportMock, loggerMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import { getSmtpConfig, sendOrderEmail } from '@/lib/mailer';

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'NOTIFY_EMAIL'] as const;
const savedEnv: Record<string, string | undefined> = {};
const sendMailMock = vi.fn();

const order = {
  orderId: 'cmd-123',
  name: 'Иван',
  phone: '+79991234567',
  location: 'МКАД 50 км',
  serviceType: 'light_vehicle',
  consent: true,
} as const;

const orderWithNumber = { ...order, number: '20260831-5' };

function setEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }
}

describe('getSmtpConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it('возвращает null когда переменные не заданы (error case)', () => {
    expect(getSmtpConfig()).toBeNull();
  });

  it('парсит список получателей через запятую с пробелами (edge case)', () => {
    setEnv({
      SMTP_HOST: 'smtp.yandex.ru',
      SMTP_USER: 'boronind1m@yandex.ru',
      SMTP_PASSWORD: 'secret',
      NOTIFY_EMAIL: ' boronin87@list.ru , igorycha.s@yandex.ru ,',
    });
    const cfg = getSmtpConfig();
    expect(cfg?.recipients).toEqual(['boronin87@list.ru', 'igorycha.s@yandex.ru']);
  });

  it('port 465 → secure=true, 587 → secure=false', () => {
    setEnv({
      SMTP_HOST: 'smtp.yandex.ru',
      SMTP_USER: 'u@yandex.ru',
      SMTP_PASSWORD: 'p',
      NOTIFY_EMAIL: 'a@list.ru',
      SMTP_PORT: '465',
    });
    expect(getSmtpConfig()?.secure).toBe(true);

    process.env.SMTP_PORT = '587';
    expect(getSmtpConfig()?.secure).toBe(false);

    delete process.env.SMTP_PORT;
    expect(getSmtpConfig()?.port).toBe(587);
  });

  it('возвращает null если отсутствует хотя бы одна переменная (edge case)', () => {
    setEnv({
      SMTP_HOST: 'smtp.yandex.ru',
      SMTP_USER: 'u@yandex.ru',
      NOTIFY_EMAIL: 'a@list.ru',
    });
    expect(getSmtpConfig()).toBeNull();
  });
});

describe('sendOrderEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
    setEnv({
      SMTP_HOST: 'smtp.yandex.ru',
      SMTP_PORT: '465',
      SMTP_USER: 'boronind1m@yandex.ru',
      SMTP_PASSWORD: 'app-password',
      NOTIFY_EMAIL: 'boronin87@list.ru,igorycha.s@yandex.ru',
    });
    sendMailMock.mockResolvedValue({ messageId: '1' });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it('тема письма с читаемым номером и номер в теле (happy path)', async () => {
    const r = await sendOrderEmail(orderWithNumber);
    expect(r).toEqual({ ok: true });
    const call = sendMailMock.mock.calls[0][0];
    expect(call.subject).toBe('Новая заявка на эвакуацию №20260831-5');
    expect(call.text).toContain('Номер: №20260831-5');
    expect(call.html).toContain('№20260831-5');
  });

  it('отправляет письмо на обоих получателей (happy path)', async () => {
    const r = await sendOrderEmail({ ...order });
    expect(r).toEqual({ ok: true });
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.yandex.ru',
        port: 465,
        secure: true,
        auth: { user: 'boronind1m@yandex.ru', pass: 'app-password' },
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'boronin87@list.ru, igorycha.s@yandex.ru',
        from: 'boronind1m@yandex.ru',
        subject: 'Новая заявка на эвакуацию #cmd-123',
      }),
    );
  });

  it('содержит поля заявки в тексте и HTML (happy path)', async () => {
    await sendOrderEmail({ ...order });
    const call = sendMailMock.mock.calls[0][0];
    expect(call.text).toContain('+7 999 123 45 67');
    expect(call.text).toContain('МКАД 50 км');
    expect(call.html).toContain('Иван');
  });

  it('skip с NOT_CONFIGURED если SMTP не настроен (error case)', async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    const r = await sendOrderEmail({ ...order });
    expect(r).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'SMTP not configured, skipping email',
      expect.objectContaining({ operation: 'mailer.skip' }),
    );
  });

  it('ошибка SMTP не бросает исключение (error case)', async () => {
    sendMailMock.mockRejectedValue(new Error('535 auth failed'));
    const r = await sendOrderEmail({ ...order });
    expect(r).toEqual({ ok: false, reason: 'SMTP_ERROR' });
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Order email failed',
      expect.objectContaining({
        operation: 'mailer.send',
        orderId: 'cmd-123',
        error: '535 auth failed',
      }),
    );
  });

  it('экранирует HTML в полях письма (edge case)', async () => {
    await sendOrderEmail({ ...order, name: '<script>x</script>' });
    const call = sendMailMock.mock.calls[0][0];
    expect(call.html).not.toContain('<script>');
    expect(call.html).toContain('&lt;script&gt;');
  });

  it('логирует начало и успех отправки (тест логирования)', async () => {
    await sendOrderEmail({ ...order });
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Sending order email',
      expect.objectContaining({ operation: 'mailer.send', orderId: 'cmd-123', recipients: 2 }),
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Order email sent',
      expect.objectContaining({ operation: 'mailer.send', orderId: 'cmd-123' }),
    );
  });
});
