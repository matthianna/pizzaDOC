import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import bcrypt from 'bcryptjs'

export const PRIORITY_USERS = [
  'valentino.dipietro',
  'mario.dipietro',
  'alessio.tshimanga',
  'giulia',
  'michele.caiazzo'
]

export function isPriorityUser(username: string): boolean {
  return PRIORITY_USERS.includes(username.toLowerCase())
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function getDayName(dayOfWeek: number): string {
  // Our system: 0=Monday, 1=Tuesday, ..., 6=Sunday
  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  return days[dayOfWeek] || 'Giorno non valido'
}

export function getShiftTypeName(shiftType: 'PRANZO' | 'CENA'): string {
  return shiftType === 'PRANZO' ? 'Pranzo' : 'Cena'
}

export function getRoleName(role: string): string {
  const roleNames: Record<string, string> = {
    'ADMIN': 'Admin',
    'FATTORINO': 'Fattorino',
    'CUCINA': 'Cucina',
    'SALA': 'Sala',
    'PIZZAIOLO': 'Pizzaiolo'
  }
  return roleNames[role] || role
}

export function getTransportName(transport: string): string {
  const transportNames: Record<string, string> = {
    'AUTO': 'Auto',
    'SCOOTER': 'Scooter'
  }
  return transportNames[transport] || transport
}

/**
 * Format login username `name.surname` → `Name Surname`.
 * Single-token usernames (e.g. `giulia`) → `Giulia`.
 */
export function formatUsername(username: string | null | undefined): string {
  if (!username) return ''
  return username
    .split('.')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}
