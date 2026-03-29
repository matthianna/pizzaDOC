import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { addWeekCalendarDays } from '@/lib/date-utils'

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export const dynamic = 'force-dynamic'

// GET /api/admin/missing-availability - Check which employees haven't submitted availability
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'weekStart parameter required' }, { status: 400 })
    }

    const weekStart = normalizeDate(weekStartParam)

    // Stesso schema di availability-overview: il DB può avere weekStart ±1 giorno (client/server, vecchi salvataggi)
    const dayMs = 24 * 60 * 60 * 1000
    const weekStartCandidates = [
      normalizeDate(new Date(weekStart.getTime() - dayMs)),
      weekStart,
      normalizeDate(new Date(weekStart.getTime() + dayMs)),
    ]

    // Fine settimana (domenica) fine giornata UTC
    const weekEnd = new Date(Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + 6,
      23, 59, 59, 999
    ))

    console.log(
      `🔍 [Missing Availability API] weekStart: ${weekStart.toISOString()} candidati: ${weekStartCandidates.map((d) => d.toISOString()).join(', ')}`
    )

    // Get all non-admin active users (exclude disabled users)
    const allUsers = await prisma.user.findMany({
      where: {
        isActive: true, // Only active users
        user_roles: {
          none: {
            role: 'ADMIN'
          }
        }
      },
      select: {
        id: true,
        username: true,
        absences: {
          where: {
            AND: [{ startDate: { lte: weekEnd } }, { endDate: { gte: weekStart } }],
          },
          select: {
            id: true,
            startDate: true,
            endDate: true
          }
        }
      }
    })

    // Get users who have submitted ANY availability for this week (regardless of isAvailable value)
    // This means they have filled out the availability form, even if they marked themselves as unavailable
    const allAvailabilityRecords = await prisma.availabilities.findMany({
      where: {
        weekStart: { in: weekStartCandidates },
      },
      select: {
        userId: true,
        isAbsentWeek: true,
        user: {
          select: {
            username: true
          }
        }
      }
    })

    // Get unique user IDs who have submitted availability (any value)
    const usersWithAvailabilityIds = new Set<string>()
    const usersAbsentForWeek = new Set<string>()
    
    allAvailabilityRecords.forEach(record => {
      usersWithAvailabilityIds.add(record.userId)
      if (record.isAbsentWeek) {
        usersAbsentForWeek.add(record.userId)
      }
    })

    console.log(`✅ [Missing Availability API] Total users with availability: ${usersWithAvailabilityIds.size}`)
    console.log(`✅ [Missing Availability API] Users absent for week: ${usersAbsentForWeek.size}`)

    // Filter users who haven't submitted availability AND are not absent for the entire week
    const missingUsers = allUsers
      .filter(user => {
        // ⭐ Skip if user has submitted availability (any value)
        if (usersWithAvailabilityIds.has(user.id)) {
          // Even if they marked themselves as absent for the week, they've submitted availability
          return false
        }

        // ⭐ Skip if user explicitly marked themselves as absent for the entire week via availability form
        if (usersAbsentForWeek.has(user.id)) {
          return false
        }

        // Check if user is absent for the entire week (all 7 days) via absences table
        if (user.absences.length === 0) return true // No absence, include them in missing list

        // Giorni della settimana (chiavi YYYY-MM-DD UTC, coerenti con weekStart DB)
        const weekDayKeys: string[] = []
        for (let i = 0; i < 7; i++) {
          weekDayKeys.push(utcDayKey(addWeekCalendarDays(weekStart, i)))
        }

        const coveredDays = new Set<string>()
        for (const absence of user.absences) {
          const absStart = utcDayKey(absence.startDate)
          const absEnd = utcDayKey(absence.endDate)
          for (const k of weekDayKeys) {
            if (k >= absStart && k <= absEnd) coveredDays.add(k)
          }
        }

        const allDaysCovered = coveredDays.size === 7
        
        return !allDaysCovered // Include only if NOT fully absent
      })
      .map(user => user.username)

    // Calculate completion percentage
    const totalUsers = allUsers.length
    const usersWithData = usersWithAvailabilityIds.size
    const completionPercentage = totalUsers > 0 ? Math.round((usersWithData / totalUsers) * 100) : 0

    console.log(`📊 [Missing Availability API] Total active users: ${totalUsers}`)
    console.log(`📊 [Missing Availability API] Users with availability: ${usersWithData}`)
    console.log(`📊 [Missing Availability API] Missing users: ${missingUsers.length}`)
    console.log(`📊 [Missing Availability API] Completion: ${completionPercentage}%`)

    return NextResponse.json(
      {
        missingUsers,
        totalUsers,
        usersWithAvailability: usersWithData,
        completionPercentage,
        weekStart: weekStart.toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    )

  } catch (error) {
    console.error('Error checking missing availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
