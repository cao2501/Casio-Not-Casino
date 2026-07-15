import { PrismaClient } from '@prisma/client';
import { logger } from '../core/logger/Logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'error' }]
      : [{ emit: 'event', level: 'error' }],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

(prisma as any).$on('error', (e: any) => {
  logger.error('Prisma error', { message: e.message });
});
