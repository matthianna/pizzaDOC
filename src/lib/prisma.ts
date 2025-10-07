import { PrismaClient } from '@prisma/client'

// Estendi globalThis per type safety
declare global {
  var __prisma: PrismaClient | undefined
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

// Funzione per creare il client
const createPrismaClient = (): PrismaClient => {
  console.log('[PRISMA] Creating new PrismaClient instance')
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
  console.log('[PRISMA] ✅ PrismaClient created successfully')
  return client
}

// Usa il singleton pattern - PER EVITARE CONNESSIONI MULTIPLE
// Funziona sia in dev che in prod (serverless)
if (!global.__prisma) {
  global.__prisma = createPrismaClient()
}

export const prisma = global.__prisma

// Verifica che prisma non sia mai undefined
if (!prisma) {
  console.error('[PRISMA] ❌ CRITICAL: Prisma instance is undefined!')
  throw new Error('Failed to initialize Prisma Client')
}

console.log('[PRISMA] ✅ Prisma export ready')
