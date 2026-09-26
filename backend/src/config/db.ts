import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma: PrismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDb(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[MySQL] Connected successfully via Prisma');
  } catch (error) {
    console.warn('[MySQL] Connection warning/error:', (error as Error).message);
  }
}
