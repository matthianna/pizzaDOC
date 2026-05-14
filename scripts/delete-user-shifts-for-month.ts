#!/usr/bin/env tsx
/**
 * Rimuove i turni (e le ore collegate, cascade) di un utente per un mese di calendario UTC,
 * stesso criterio di /api/hours (weekStart bounds + shiftCalendarDateUtc + isUtcCalendarMonth).
 *
 * Uso (da directory pizzadoc):
 *   npx tsx scripts/delete-user-shifts-for-month.ts mauro.giannattasio 2026 3
 *   DRY_RUN=1 npx tsx scripts/delete-user-shifts-for-month.ts mauro.giannattasio 2026 3
 */

import { loadEnvConfig } from '@next/env'
import { PrismaClient } from '@prisma/client'
import {
  isUtcCalendarMonth,
  shiftCalendarDateUtc,
  utcWeekStartBoundsForCalendarMonth,
} from '../src/lib/date-utils'

loadEnvConfig(process.cwd())

const prisma = new PrismaClient()

function parseArgs() {
  const username = process.argv[2]
  const year = parseInt(process.argv[3] ?? '', 10)
  const month = parseInt(process.argv[4] ?? '', 10)
  const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')
  if (!username || !Number.isFinite(year) || !Number.isFinite(month)) {
    console.error(
      'Uso: npx tsx scripts/delete-user-shifts-for-month.ts <username> <anno> <mese 1-12> [--dry-run]'
    )
    process.exit(1)
  }
  return { username, year, month, dryRun }
}

async function main() {
  const { username, year, month, dryRun } = parseArgs()

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  })
  if (!user) {
    console.error(`Utente non trovato: ${username}`)
    process.exit(1)
  }

  const { gte, lte } = utcWeekStartBoundsForCalendarMonth(year, month)

  const candidates = await prisma.shifts.findMany({
    where: {
      userId: user.id,
      schedules: { weekStart: { gte, lte } },
    },
    include: { schedules: true, worked_hours: true },
  })

  const toDelete = candidates.filter((s) =>
    isUtcCalendarMonth(shiftCalendarDateUtc(s.schedules.weekStart, s.dayOfWeek), year, month)
  )

  for (const s of toDelete) {
    const day = shiftCalendarDateUtc(s.schedules.weekStart, s.dayOfWeek)
    const wh = s.worked_hours
      ? ` ore=${s.worked_hours.totalHours}h (${s.worked_hours.status})`
      : ' nessuna ore'
    console.log(
      `${day.toISOString().slice(0, 10)} ${s.shiftType} ${s.startTime}-${s.endTime} id=${s.id}${wh}`
    )
  }

  console.log(`\nTotale turni da eliminare: ${toDelete.length}${dryRun ? ' (DRY RUN)' : ''}`)

  if (dryRun || toDelete.length === 0) {
    await prisma.$disconnect()
    return
  }

  const res = await prisma.shifts.deleteMany({
    where: { id: { in: toDelete.map((s) => s.id) } },
  })

  console.log(`Eliminati ${res.count} turni (worked_hours e substitutions in cascade).`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
