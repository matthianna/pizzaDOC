/**
 * Normalizza una data a mezzanotte (00:00:00.000) nel fuso orario locale
 * Questo previene problemi di timezone tra localhost e Vercel (UTC)
 * 
 * @param dateString - Stringa ISO o Date object
 * @returns Data normalizzata a mezzanotte
 */
export function normalizeDate(dateString: string | Date): Date {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

