import { prisma } from '@/lib/prisma'

/**
 * Richieste ancora in attesa di candidati: passata la scadenza (inizio turno),
 * segnale come EXPIRED così compaiono in "Scadute" e non bloccano nuove richieste.
 */
export async function expireSubstitutionsPastDeadline(now = new Date()) {
  return prisma.substitutions.updateMany({
    where: {
      status: 'PENDING',
      substituteId: null,
      deadline: { lte: now },
    },
    data: {
      status: 'EXPIRED',
      updatedAt: now,
    },
  })
}
