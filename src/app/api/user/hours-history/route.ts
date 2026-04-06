import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate, formatMonthYearIt, shiftCalendarDateUtc } from '@/lib/date-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    // Default to current year if not specified
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    // Get approved worked hours grouped by month
    const workedHours = await prisma.worked_hours.findMany({
      where: {
        shifts: {
          userId: session.user.id
        },
        status: 'APPROVED',
        submittedAt: {
          gte: new Date(targetYear, 0, 1), // January 1st
          lt: new Date(targetYear + 1, 0, 1) // January 1st next year
        }
      },
      include: {
        shifts: {
          include: {
            schedules: true
          }
        }
      },
      orderBy: {
        submittedAt: 'asc'
      }
    })

    // Group by month and calculate totals
    const monthlyData: Record<string, {
      month: string
      totalHours: number
      shiftsCount: number
      avgHoursPerShift: number
      details: Array<{
        date: string
        role: string
        shiftType: string
        hours: number
        startTime: string
        endTime: string
      }>
    }> = {}

    workedHours.forEach((wh: any) => {
      const shiftDate = shiftCalendarDateUtc(wh.shifts.schedules.weekStart, wh.shifts.dayOfWeek)

      const monthKey = `${shiftDate.getUTCFullYear()}-${String(shiftDate.getUTCMonth() + 1).padStart(2, '0')}`
      const monthName = formatMonthYearIt(shiftDate)

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthName,
          totalHours: 0,
          shiftsCount: 0,
          avgHoursPerShift: 0,
          details: []
        }
      }

      monthlyData[monthKey].totalHours += wh.totalHours
      monthlyData[monthKey].shiftsCount += 1
      monthlyData[monthKey].details.push({
        date: formatDate(shiftDate),
        role: wh.shifts.role,
        shiftType: wh.shifts.shiftType,
        hours: wh.totalHours,
        startTime: wh.startTime,
        endTime: wh.endTime
      })
    })

    // Calculate averages
    Object.keys(monthlyData).forEach(key => {
      const data = monthlyData[key]
      data.avgHoursPerShift = data.shiftsCount > 0 ?
        parseFloat((data.totalHours / data.shiftsCount).toFixed(2)) : 0
    })

    // Convert to array and sort by month
    const result = Object.keys(monthlyData)
      .sort()
      .map(key => monthlyData[key])

    // Get all years that have data for this user
    const yearsWithData = await prisma.worked_hours.findMany({
      where: {
        shifts: {
          userId: session.user.id
        },
        status: 'APPROVED'
      },
      select: {
        submittedAt: true
      },
      distinct: ['submittedAt']
    })

    const availableYears = Array.from(new Set(yearsWithData.map(wh => new Date(wh.submittedAt).getFullYear()))).sort((a, b) => b - a)

    return NextResponse.json({
      year: targetYear,
      months: result,
      totalYearHours: result.reduce((sum, month) => sum + month.totalHours, 0),
      totalYearShifts: result.reduce((sum, month) => sum + month.shiftsCount, 0),
      availableYears: availableYears.length > 0 ? availableYears : [targetYear]
    })
  } catch (error) {
    console.error('Error fetching hours history:', error)
    return NextResponse.json(
      { error: 'Impossibile caricare lo storico ore' },
      { status: 500 }
    )
  }
}
