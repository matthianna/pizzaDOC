import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { it } from 'date-fns/locale'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    // Default to current year if not specified
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    // Get approved worked hours grouped by month
    const workedHours = await prisma.workedHours.findMany({
      where: {
        shift: {
          userId: session.user.id
        },
        status: 'APPROVED',
        submittedAt: {
          gte: new Date(targetYear, 0, 1), // January 1st
          lt: new Date(targetYear + 1, 0, 1) // January 1st next year
        }
      },
      include: {
        shift: {
          include: {
            schedule: true
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

    workedHours.forEach(wh => {
      const shiftDate = new Date(wh.shift.schedule.weekStart)
      shiftDate.setDate(shiftDate.getDate() + (wh.shift.dayOfWeek === 0 ? 6 : wh.shift.dayOfWeek - 1))
      
      const monthKey = format(shiftDate, 'yyyy-MM')
      const monthName = format(shiftDate, 'MMMM yyyy', { locale: it })

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
        date: format(shiftDate, 'dd/MM/yyyy'),
        role: wh.shift.role,
        shiftType: wh.shift.shiftType,
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

    return NextResponse.json({
      year: targetYear,
      months: result,
      totalYearHours: result.reduce((sum, month) => sum + month.totalHours, 0),
      totalYearShifts: result.reduce((sum, month) => sum + month.shiftsCount, 0)
    })
  } catch (error) {
    console.error('Error fetching hours history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hours history' },
      { status: 500 }
    )
  }
}
