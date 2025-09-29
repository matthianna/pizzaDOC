import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import bcrypt from 'bcryptjs'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function formatTime(time: string): string {
  return time.slice(0, 5) // "HH:MM"
}

export function calculateHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  const diffMinutes = endMinutes - startMinutes
  return Math.round((diffMinutes / 60) * 2) / 2 // Round to nearest 0.5
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
