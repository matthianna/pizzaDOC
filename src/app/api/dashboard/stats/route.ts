import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

    const isAdmin = session.user.roles.includes('ADMIN')

    let stats: any = {}

    if (isAdmin) {
      // Admin stats
      const [
        totalUsers,
        activeUsers,
        pendingHours,
        thisWeekSchedules,
        pendingSubstitutions
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.workedHours.count({ where: { status: 'PENDING' } }),
        prisma.schedule.count({
          where: {
            weekStart: {
              gte: weekStart,
              lte: weekEnd
            }
          }
        }),
        prisma.substitution.count({ where: { status: 'PENDING' } })
      ])

      stats = {
        totalUsers,
        activeUsers,
        pendingHours,
        thisWeekSchedules,
        pendingSubstitutions
      }
    } else {
      // User stats
      const [
        myShiftsThisWeek,
        myHoursThisMonth,
        myPendingSubstitutions,
        myApprovedHours
      ] = await Promise.all([
        prisma.shift.count({
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
        prisma.workedHours.aggregate({
          where: {
            userId: session.user.id,
            submittedAt: {
              gte: monthStart,
              lte: monthEnd
            }
          },
          _sum: { totalHours: true }
        }),
        prisma.substitution.count({
          where: {
            requesterId: session.user.id,
            status: 'PENDING'
          }
        }),
        prisma.workedHours.aggregate({
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
