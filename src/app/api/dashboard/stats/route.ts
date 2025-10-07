import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { normalizeDate } from '@/lib/normalize-date'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const weekStart = normalizeDate(startOfWeek(now, { weekStartsOn: 1 }))
    const weekEnd = normalizeDate(endOfWeek(now, { weekStartsOn: 1 }))

    const isAdmin = session.user.roles.includes('ADMIN')

    let stats: any = {}

    if (isAdmin) {
      // Admin stats - statistiche complete
      const [
        totalUsers,
        activeUsers,
        pendingHours,
        thisWeekSchedules,
        pendingSubstitutions,
        totalShiftsThisWeek,
        totalAbsencesActive,
        availabilitiesThisWeek,
        approvedSubstitutions
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.worked_hours.count({ where: { status: 'PENDING' } }),
        prisma.schedules.count({
          where: {
            weekStart: {
              gte: weekStart,
              lte: weekEnd
            }
          }
        }),
        prisma.substitutions.count({ where: { status: 'PENDING' } }),
        prisma.shifts.count({
          where: {
            schedules: {
              weekStart: {
                gte: weekStart,
                lte: weekEnd
              }
            }
          }
        }),
        prisma.absences.count({
          where: {
            startDate: { lte: now },
            endDate: { gte: now }
          }
        }),
        prisma.availabilities.count({
          where: {
            weekStart: {
              gte: weekStart,
              lte: weekEnd
            },
            isAvailable: true
          }
        }),
        prisma.substitutions.count({ where: { status: 'APPROVED' } })
      ])

      stats = {
        totalUsers,
        activeUsers,
        pendingHours,
        thisWeekSchedules,
        pendingSubstitutions,
        totalShiftsThisWeek,
        totalAbsencesActive,
        availabilitiesThisWeek,
        approvedSubstitutions
      }
    } else {
      // User stats
      const [
        myShiftsThisWeek,
        myHoursThisMonth,
        myPendingSubstitutions,
        myApprovedHours
      ] = await Promise.all([
        prisma.shifts.count({
          where: {
            userId: session.user.id,
            schedule: {
              weekStart: {
                gte: weekStart,
                lte: weekEnd
              }
            }
          }
        }),
        prisma.worked_hours.aggregate({
          where: {
            userId: session.user.id,
            submittedAt: {
              gte: monthStart,
              lte: monthEnd
            }
          },
          _sum: { totalHours: true }
        }),
        prisma.substitutions.count({
          where: {
            requesterId: session.user.id,
            status: 'PENDING'
          }
        }),
        prisma.worked_hours.aggregate({
          where: {
            userId: session.user.id,
            status: 'APPROVED',
            submittedAt: {
              gte: monthStart,
              lte: monthEnd
            }
          },
          _sum: { totalHours: true }
        })
      ])

      stats = {
        myShiftsThisWeek,
        myHoursThisMonth: myHoursThisMonth._sum.totalHours || 0,
        myPendingSubstitutions,
        myApprovedHours: myApprovedHours._sum.totalHours || 0
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
