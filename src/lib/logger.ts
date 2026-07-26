import pino, { type Logger as PinoLogger } from 'pino';

// Структурированный логгер (см. SKILL_DEVELOPER.md §2).
// redact маскирует ПД и секреты в логах (152-ФЗ).
//
// ВАЖНО: НЕ используем pino `transport: pino-pretty` — он запускается через
// worker thread и несовместим с webpack-бандлингом Next.js (RuntimeError:
// "unable to determine transport target"). Для pretty-вывода в dev —
// пайп stdout:  `npm run dev | npx pino-pretty`
//
// Обёртка приводит pino-вызовы к каноничному для проекта виду:
//   logger.info('Сообщение', { operation, ...контекст })
// Внутри транслируется в pino-вызов: pinoLogger.info(context, message).

const pinoLogger: PinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'evakuaciya-msk-mo' },
  redact: {
    paths: [
      '*.password',
      '*.token',
      '*.phone',
      '*.secret',
      'req.headers.authorization',
      '*.ip',
    ],
    censor: '[REDACTED]',
  },
});

type LogContext = Record<string, unknown>;

export const logger = {
  info: (message: string, context?: LogContext) =>
    pinoLogger.info(context ?? {}, message),
  warn: (message: string, context?: LogContext) =>
    pinoLogger.warn(context ?? {}, message),
  error: (message: string, context?: LogContext) =>
    pinoLogger.error(context ?? {}, message),
  debug: (message: string, context?: LogContext) =>
    pinoLogger.debug(context ?? {}, message),
  fatal: (message: string, context?: LogContext) =>
    pinoLogger.fatal(context ?? {}, message),
  trace: (message: string, context?: LogContext) =>
    pinoLogger.trace(context ?? {}, message),
  child: (bindings: LogContext) => pinoLogger.child(bindings) as PinoLogger,
  // Прямой доступ к pino-инстансу (для $on в prisma и пр.).
  raw: pinoLogger,
};

export type Logger = typeof logger;
