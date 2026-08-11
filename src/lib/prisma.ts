import { PrismaClient } from '@prisma/client'
import { withPrismaRetry } from '@/lib/prisma-retry'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof createPrismaClient> | undefined
}

if (!process.env.DATABASE_URL) {
  console.error('[PRISMA] ⚠️ CRITICAL: DATABASE_URL is not defined!')
  throw new Error('DATABASE_URL environment variable is required')
}

function databaseUrlWithTimeouts(url: string): string {
  try {
    const u = new URL(url)
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '30')
    }
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', '20')
    }
    return u.toString()
  } catch {
    return url
  }
}

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrlWithTimeouts(process.env.DATABASE_URL!),
      },
    },
  })

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        return withPrismaRetry(() => query(args), { retries: 3, delayMs: 400 })
      },
    },
  })
}

if (!global.__prisma) {
  global.__prisma = createPrismaClient()
}

export const prisma = global.__prisma
