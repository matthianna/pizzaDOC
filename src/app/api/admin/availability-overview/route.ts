import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { addWeekCalendarDays } from '@/lib/date-utils'
import {
  dateForAvailabilityDay,
  holidayBlocksSlot,
  utcCalendarKey,
} from '@/lib/availability-holidays'

// ⚠️ IMPORTANTE: Disabilita cache per avere sempre dati aggiornati
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // ✅ ACCESSIBILE A TUTTI GLI UTENTI AUTENTICATI (non solo admin)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'weekStart parameter required' }, { status: 400 })
    }

    const weekStart = normalizeDate(weekStartParam)

    // Chiavi ±1 giorno (mezzanotte UTC): assorbono piccoli scarti tra client/server o dati
    // salvati con convenzione leggermente diversa; l'ora legale di per sé non cambia il
    // giorno di calendario del lunedì, ma questo evita griglie vuote se weekStart nel DB
    // differisce di un giorno dalla richiesta.
    const dayMs = 24 * 60 * 60 * 1000
    const weekStartCandidates = [
      normalizeDate(new Date(weekStart.getTime() - dayMs)),
      weekStart,
      normalizeDate(new Date(weekStart.getTime() + dayMs))
    ]
    
    const weekEndDay = addWeekCalendarDays(weekStart, 6)
    const weekEnd = new Date(
      Date.UTC(
        weekEndDay.getUTCFullYear(),
        weekEndDay.getUTCMonth(),
        weekEndDay.getUTCDate(),
        23,
        59,
        59,
        999
      )
    )

    console.log(`🔍 Cercando disponibilità per weekStart: ${weekStart.toISOString()} (candidati: ${weekStartCandidates.map(d => d.toISOString()).join(', ')})`)

    const weekSunday = dateForAvailabilityDay(weekStart, 6)

    const [users, holidays] = await Promise.all([
      prisma.user.findMany({
      where: {
        isActive: true,
        user_roles: {
          none: {
            role: 'ADMIN'
          }
        }
      },
      include: {
        availabilities: {
          where: {
            weekStart: { in: weekStartCandidates }
          }
        },
        absences: {
          where: {
            OR: [
              {
                AND: [
                  { startDate: { lte: weekEnd } },
                  { endDate: { gte: weekStart } }
                ]
              }
            ]
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
      }),
      prisma.holidays.findMany({
        where: {
          date: { gte: weekStart, lte: weekSunday },
        },
        select: { date: true, closureType: true, description: true },
      }),
    ])

    const usersAvailability = users.map(user => {
      const targetMs = weekStart.getTime()
      const sorted = [...user.availabilities].sort(
        (a, b) =>
          Math.abs(a.weekStart.getTime() - targetMs) -
          Math.abs(b.weekStart.getTime() - targetMs)
      )
      const bySlot = new Map<
        string,
        { dayOfWeek: number; shiftType: string; isAvailable: boolean }
      >()
      for (const av of sorted) {
        const key = `${av.dayOfWeek}-${av.shiftType}`
        if (!bySlot.has(key)) {
          bySlot.set(key, {
            dayOfWeek: av.dayOfWeek,
            shiftType: av.shiftType,
            isAvailable: av.isAvailable
          })
        }
      }

      const slots = Array.from(bySlot.values()).map((slot) => {
        const slotKey = utcCalendarKey(
          dateForAvailabilityDay(weekStart, slot.dayOfWeek)
        )
        const blocked = holidayBlocksSlot(
          holidays,
          slotKey,
          slot.shiftType as 'PRANZO' | 'CENA'
        )
        if (blocked && slot.isAvailable) {
          return { ...slot, isAvailable: false }
        }
        return slot
      })

      return {
      userId: user.id,
      username: user.username,
      primaryRole: user.primaryRole,
      availabilities: slots,
      absences: user.absences.map(abs => ({
        id: abs.id,
        startDate: abs.startDate.toISOString(),
        endDate: abs.endDate.toISOString(),
        reason: abs.reason
      }))
    }
    })

    console.log(`✅ Trovati ${users.length} utenti`)
    console.log(`📊 Disponibilità totali: ${users.reduce((sum, u) => sum + u.availabilities.length, 0)}`)

    // ⚠️ Headers anti-cache per garantire dati sempre freschi
    return NextResponse.json({
      users: usersAvailability,
      weekStart: weekStart.toISOString(),
      holidays: holidays.map((h) => ({
        date: h.date.toISOString(),
        closureType: h.closureType,
        description: h.description,
      })),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching availability overview:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

