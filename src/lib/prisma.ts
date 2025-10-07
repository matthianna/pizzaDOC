import { PrismaClient } from '@prisma/client'

// Estendi globalThis per type safety
declare global {
  var prisma: PrismaClient | undefined
}

// Log per debug
console.log('[PRISMA] Initializing Prisma Client...')
console.log('[PRISMA] NODE_ENV:', process.env.NODE_ENV)
console.log('[PRISMA] VERCEL:', process.env.VERCEL ? 'Yes' : 'No')
console.log('[PRISMA] DATABASE_URL present:', !!process.env.DATABASE_URL)

if (!process.env.DATABASE_URL) {
  console.error('[PRISMA] ⚠️ CRITICAL: DATABASE_URL is not defined!')
  throw new Error('DATABASE_URL environment variable is required')
}

// Crea o riusa l'istanza globale - SINGLETON PATTERN
const createPrismaClient = () => {
  console.log('[PRISMA] Creating new PrismaClient instance')
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// Usa singleton pattern sia in dev che in prod
export const prisma = globalThis.prisma || createPrismaClient()

// Salva in globalThis per riuso (importante sia in dev che prod)
if (!globalThis.prisma) {
  globalThis.prisma = prisma
  console.log('[PRISMA] ✅ Prisma Client cached in globalThis')
}
