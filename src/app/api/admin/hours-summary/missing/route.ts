import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const weekStartParam = searchParams.get('weekStart')
    
    // Se non specificato, usa la settimana corrente
    const now = new Date()
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
    const defaultWeekStart = new Date(now)
    defaultWeekStart.setDate(now.getDate() - dayOfWeek)
    defaultWeekStart.setHours(0, 0, 0, 0)
    
    const weekStart = weekStartParam ? new Date(weekStartParam) : defaultWeekStart
    weekStart.setHours(0, 0, 0, 0)

    // Ottieni tutti i turni della settimana
    const shifts = await prisma.shifts.findMany({
      where: {
        schedules: {
          weekStart: weekStart
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true,
            isActive: true
          }
        },
        worked_hours: {
          select: {
            id: true,
            totalHours: true,
            status: true
          }
        }
      }
    })

    // Filtra solo turni senza ore inviate e utenti attivi
    const missingHours = shifts
      .filter(shift => shift.worked_hours.length === 0 && shift.user.isActive)
      .map(shift => ({
        shiftId: shift.id,
        userId: shift.user.id,
        username: shift.user.username,
        primaryRole: shift.user.primaryRole,
        dayOfWeek: shift.dayOfWeek,
        shiftType: shift.shiftType,
        role: shift.role,
        startTime: shift.startTime,
        endTime: shift.endTime
      }))

    // Raggruppa per utente
    const groupedByUser = missingHours.reduce((acc, item) => {
      if (!acc[item.userId]) {
        acc[item.userId] = {
          userId: item.userId,
          username: item.username,
          primaryRole: item.primaryRole,
          shifts: []
        }
      }
      acc[item.userId].shifts.push({
        shiftId: item.shiftId,
        dayOfWeek: item.dayOfWeek,
        shiftType: item.shiftType,
        role: item.role,
        startTime: item.startTime,
        endTime: item.endTime
      })
      return acc
    }, {} as Record<string, any>)

    const result = Object.values(groupedByUser).sort((a: any, b: any) => 
      a.username.localeCompare(b.username)
    )

    return NextResponse.json({
      weekStart: weekStart.toISOString(),
      missingHours: result
    })
  } catch (error) {
    console.error('Error fetching missing hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

