import { PrismaClient } from '@prisma/client'

// Estendi globalThis per type safety
declare global {
  var prisma: PrismaClient | undefined
}

// Log per debug
if (!process.env.DATABASE_URL) {
  console.error('[PRISMA] DATABASE_URL is not defined!')
} else {
  console.log('[PRISMA] DATABASE_URL is configured')
}

// Crea o riusa l'istanza globale
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

// In development, salva il client in cache per hot reload
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

// Verifica connessione al primo utilizzo
prisma.$connect()
  .then(() => console.log('[PRISMA] Database connected successfully'))
  .catch((e) => console.error('[PRISMA] Database connection failed:', e))
