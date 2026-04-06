import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { shiftCalendarDateUtc } from '@/lib/date-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    const roles = session?.user?.roles
    if (!session?.user?.id || !Array.isArray(roles) || !roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    // Build where clause
    const where: {
      status: string;
      userId?: string;
    } = {
      status: 'APPROVED' // Solo ore approvate
    }

    if (userId) {
      where.userId = userId
    }

    // ⚠️ NON filtriamo per submittedAt perché vogliamo filtrare sulla data EFFETTIVA del turno
    // Il filtro per mese/anno verrà applicato DOPO aver calcolato la data del turno

    // Get worked hours with user and shift info
    const workedHours = await prisma.worked_hours.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        shifts: {
          select: {
            dayOfWeek: true,
            shiftType: true,
            role: true,
            schedules: {
              select: {
                weekStart: true
              }
            }
          }
        }
      },
      orderBy: [
        { user: { username: 'asc' } },
        { submittedAt: 'desc' }
      ]
    })

    // ✅ PRIMA filtra i workedHours per anno/mese basandosi sulla data EFFETTIVA del turno
    const filteredWorkedHours = workedHours.filter((wh) => {
      const shiftDate = shiftCalendarDateUtc(wh.shifts.schedules.weekStart, wh.shifts.dayOfWeek)
      const shiftYear = shiftDate.getUTCFullYear()
      const shiftMonth = shiftDate.getUTCMonth() + 1
      if (shiftYear !== year) return false
      if (month !== null && shiftMonth !== month) return false
      return true
    })

    // Group by user and month
    const summary: Record<string, {
      user: {
        id: string;
        username: string;
        primaryRole: string;
      }
      monthlyHours: Record<string, {
        totalHours: number
        shiftsCount: number
        details: Array<{
          id: string;
          totalHours: number;
          submittedAt: Date;
        }>
      }>
      yearlyTotal: number
    }> = {}

    filteredWorkedHours.forEach((wh) => {
      const userId = wh.user.id

      const shiftDate = shiftCalendarDateUtc(wh.shifts.schedules.weekStart, wh.shifts.dayOfWeek)
      const monthKey = shiftDate.toISOString().slice(0, 7)

      if (!summary[userId]) {
        summary[userId] = {
          user: wh.user,
          monthlyHours: {},
          yearlyTotal: 0
        }
      }

      if (!summary[userId].monthlyHours[monthKey]) {
        summary[userId].monthlyHours[monthKey] = {
          totalHours: 0,
          shiftsCount: 0,
          details: []
        }
      }

      summary[userId].monthlyHours[monthKey].totalHours += wh.totalHours
      summary[userId].monthlyHours[monthKey].shiftsCount += 1
      summary[userId].monthlyHours[monthKey].details.push({
        id: wh.id,
        shiftId: wh.shiftId,
        startTime: wh.startTime,
        endTime: wh.endTime,
        totalHours: wh.totalHours,
        submittedAt: wh.submittedAt,
        shift: wh.shifts
      })
      
      summary[userId].yearlyTotal += wh.totalHours
    })

    // Convert to array format
    const result = Object.values(summary).map(userSummary => ({
      ...userSummary,
      monthlyHours: Object.entries(userSummary.monthlyHours).map(([month, data]) => {
        // ✅ Ordina i dettagli (turni) cronologicamente per data effettiva
        const sortedDetails = data.details.sort((a: any, b: any) => {
          const shiftDateA = shiftCalendarDateUtc(a.shift.schedules.weekStart, a.shift.dayOfWeek)
          const shiftDateB = shiftCalendarDateUtc(b.shift.schedules.weekStart, b.shift.dayOfWeek)

          if (shiftDateA.getTime() !== shiftDateB.getTime()) {
            return shiftDateA.getTime() - shiftDateB.getTime()
          }
          
          // Se stessa data, ordina per tipo turno (PRANZO prima di CENA)
          if (a.shift.shiftType !== b.shift.shiftType) {
            return a.shift.shiftType === 'PRANZO' ? -1 : 1
          }
          
          return 0
        })
        
        return {
        month,
          totalHours: data.totalHours,
          shiftsCount: data.shiftsCount,
          details: sortedDetails
        }
      }).sort((a, b) => a.month.localeCompare(b.month))
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching hours summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
