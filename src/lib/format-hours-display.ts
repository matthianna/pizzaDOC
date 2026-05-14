/**
 * Mostra ore decimali (es. da DB / somme) come durata leggibile in italiano.
 * Esempi: 4.166… → "4h e 10 min", 23.2 → "23h e 12 min", 4 → "4h".
 */
export function formatDecimalHoursIt(totalHours: number): string {
  if (!Number.isFinite(totalHours)) return '0h'
  const totalMinutes = Math.round(Math.max(0, totalHours) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0 && m > 0) return `${h}h e ${m} min`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m} min`
  return '0h'
}
