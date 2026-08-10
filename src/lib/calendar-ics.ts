import { randomBytes } from 'crypto'
import type { Role, ShiftType } from '@prisma/client'
import {
  addWeekCalendarDays,
  getWeekStart,
  shiftCalendarDateUtc,
  shiftInstantRome,
} from '@/lib/date-utils'
import { getRoleName } from '@/lib/utils'

/** Fixed calendar end times (plan): lunch 14:00, dinner 22:00. */
export function calendarEndTime(shiftType: ShiftType): string {
  return shiftType === 'PRANZO' ? '14:00' : '22:00'
}

export function generateCalendarToken(): string {
  return randomBytes(32).toString('hex')
}

/** ICS text escaping per RFC 5545. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
}

/** Format Date as UTC ICS timestamp: YYYYMMDDTHHMMSSZ */
export function formatIcsUtc(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${hh}${mm}${ss}Z`
}

export type CalendarShiftInput = {
  id: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  weekStart: Date | string
  updatedAt?: Date | string | null
}

export function getCalendarFeedWeekRange(now: Date = new Date()): {
  fromWeekStart: Date | null
  toWeekStart: Date
} {
  const current = getWeekStart(now)
  return {
    // Include all historical shifts so Apple Calendar shows the full past schedule.
    fromWeekStart: null,
    toWeekStart: addWeekCalendarDays(current, 56),
  }
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let remaining = line
  parts.push(remaining.slice(0, 75))
  remaining = remaining.slice(75)
  while (remaining.length > 0) {
    parts.push(' ' + remaining.slice(0, 74))
    remaining = remaining.slice(74)
  }
  return parts.join('\r\n')
}

function buildVEvent(shift: CalendarShiftInput): string {
  const dayUtc = shiftCalendarDateUtc(shift.weekStart, shift.dayOfWeek)
  const start = shiftInstantRome(dayUtc, shift.startTime)
  const end = shiftInstantRome(dayUtc, calendarEndTime(shift.shiftType))
  const mealLabel = shift.shiftType === 'PRANZO' ? 'PRANZO' : 'CENA'
  const summary = `Turno di Lavoro ${mealLabel}`
  const roleLabel = getRoleName(shift.role)
  const stamp = shift.updatedAt ? new Date(shift.updatedAt) : new Date()
  const uid = `${shift.id}@pizzadoc`

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(stamp)}`,
    `DTSTART:${formatIcsUtc(new Date(start.getTime()))}`,
    `DTEND:${formatIcsUtc(new Date(end.getTime()))}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(`PizzaDOC — ${summary} · ${roleLabel}`)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
  ]

  return lines.map(foldIcsLine).join('\r\n')
}

export function buildPersonalCalendarIcs(opts: {
  username: string
  shifts: CalendarShiftInput[]
}): string {
  const prodId = '-//PizzaDOC//Personal Schedule//IT'
  const calName = `PizzaDOC — ${opts.username}`
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    'X-WR-TIMEZONE:Europe/Rome',
  ]

  const events = opts.shifts.map((s) => buildVEvent(s))
  const body = [...header, ...events, 'END:VCALENDAR'].join('\r\n')
  return body + '\r\n'
}

export function calendarFeedUrls(origin: string, token: string): {
  httpsUrl: string
  webcalUrl: string
} {
  const base = origin.replace(/\/$/, '')
  const httpsUrl = `${base}/api/calendar/${token}.ics`
  const webcalUrl = httpsUrl.replace(/^https:/i, 'webcal:').replace(/^http:/i, 'webcal:')
  return { httpsUrl, webcalUrl }
}

export function resolvePublicOrigin(requestUrl: string): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const url = new URL(requestUrl)
  return `${url.protocol}//${url.host}`
}

/** Strip optional `.ics` suffix from route token param. */
export function normalizeCalendarTokenParam(raw: string): string {
  return raw.endsWith('.ics') ? raw.slice(0, -4) : raw
}
