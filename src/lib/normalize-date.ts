/**
 * Normalizza una data a mezzanotte UTC (00:00:00.000)
 * Questo garantisce consistenza tra localhost e Vercel
 * 
 * @param dateString - Stringa ISO o Date object
 * @returns Data normalizzata a mezzanotte UTC
 */
export function normalizeDate(dateString: string | Date): Date {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  // Usa UTC per evitare problemi di timezone
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
}

