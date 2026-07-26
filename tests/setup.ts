// vitest setup: мокируем ENV, чтобы тесты не зависели от .env
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'warn';
process.env.RATE_LIMIT_ORDERS_PER_HOUR = process.env.RATE_LIMIT_ORDERS_PER_HOUR || '3';
