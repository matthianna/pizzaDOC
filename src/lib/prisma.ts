import { PrismaClient } from '@prisma/client'

// Estendi globalThis per type safety
declare global {
  var prisma: PrismaClient | undefined
}

// Crea o riusa l'istanza globale
export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// In development, salva il client in cache per hot reload
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}
