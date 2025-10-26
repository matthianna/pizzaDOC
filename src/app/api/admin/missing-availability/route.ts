import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

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

    // Calculate weekEnd (Sunday UTC midnight)
    const weekEnd = new Date(Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + 6,
      23, 59, 59, 999
    ))

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
            OR: [
              {
                AND: [
                  { startDate: { lte: weekStart } },
                  { endDate: { gte: weekEnd } }
                ]
              },
              {
                AND: [
                  { startDate: { gte: weekStart } },
                  { endDate: { lte: weekEnd } }
                ]
              },
              {
                AND: [
                  { startDate: { lte: weekStart } },
                  { endDate: { gte: weekStart, lte: weekEnd } }
                ]
              },
              {
                AND: [
                  { startDate: { gte: weekStart, lte: weekEnd } },
                  { endDate: { gte: weekEnd } }
                ]
              }
            ]
          },
          select: {
            id: true,
            startDate: true,
            endDate: true
          }
        }
      }
    })

    // Get users who have submitted TRUE availability for this week
    const usersWithAvailability = await prisma.availabilities.findMany({
      where: {
        weekStart: weekStart,
        isAvailable: true // Only count users who are actually available
      },
      select: {
        userId: true,
        user: {
          select: {
            username: true
          }
        }
      },
      distinct: ['userId']
    })

    // Create set of user IDs who have TRUE availability
    const usersWithAvailabilityIds = new Set(
      usersWithAvailability.map(a => a.userId)
    )

    // Filter users who haven't submitted availability AND are not absent for the entire week
    const missingUsers = allUsers
      .filter(user => {
        // Skip if user has availability
        if (usersWithAvailabilityIds.has(user.id)) return false

        // Check if user is absent for the entire week (all 7 days)
        if (user.absences.length === 0) return true // No absence, include them

        // Calculate how many days of the week are covered by absences
        const weekStartTime = weekStart.getTime()
        const weekEndTime = weekEnd.getTime()
        const oneDayMs = 24 * 60 * 60 * 1000

        // Create set of all days in the week (7 days)
        const weekDays = new Set<string>()
        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(weekStartTime + i * oneDayMs)
          weekDays.add(dayDate.toISOString().split('T')[0])
        }

        // Mark days covered by absences
        const coveredDays = new Set<string>()
        for (const absence of user.absences) {
          const absenceStart = Math.max(absence.startDate.getTime(), weekStartTime)
          const absenceEnd = Math.min(absence.endDate.getTime(), weekEndTime)
          
          let currentDay = absenceStart
          while (currentDay <= absenceEnd) {
            const dayStr = new Date(currentDay).toISOString().split('T')[0]
            coveredDays.add(dayStr)
            currentDay += oneDayMs
          }
        }

        // If all 7 days are covered by absences, exclude from missing list
        const allDaysCovered = weekDays.size === coveredDays.size && 
                              Array.from(weekDays).every(day => coveredDays.has(day))
        
        return !allDaysCovered // Include only if NOT fully absent
      })
      .map(user => user.username)

    // Calculate completion percentage
    const totalUsers = allUsers.length
    const usersWithData = usersWithAvailability.length
    const completionPercentage = totalUsers > 0 ? Math.round((usersWithData / totalUsers) * 100) : 0

    return NextResponse.json({
      missingUsers,
      totalUsers,
      usersWithAvailability: usersWithData,
      completionPercentage,
      weekStart: weekStart.toISOString()
    })

  } catch (error) {
    console.error('Error checking missing availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
