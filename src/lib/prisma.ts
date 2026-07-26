import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

// Singleton Prisma-клиента (см. SKILL_DEVELOPER.md §1).
// Защита от создания множества инстансов в dev (hot reload).

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export const prisma =
  global.__prismaClient ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prismaClient = prisma;
}

export async function pingDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error('DB ping failed', {
      operation: 'db.ping',
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

