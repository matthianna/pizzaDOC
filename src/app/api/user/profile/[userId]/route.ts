import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays, parseISO } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { userId: requestedUserId } = await params

    // Solo admin o l'utente stesso può vedere il profilo
    if (session.user.role !== 'ADMIN' && session.user.id !== requestedUserId) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: requestedUserId },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        primaryRole: true,
        primaryTransport: true,
        isActive: true,
        user_roles: {
          select: {
            role: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    // Calcola ore totali
    const workedHours = await prisma.worked_hours.findMany({
      where: { 
        userId: requestedUserId,
        status: 'APPROVED'
      },
      select: {
        id: true,
        submittedAt: true,
        totalHours: true,
        shifts: {
          select: {
            dayOfWeek: true,
            shiftType: true,
            startTime: true,
            endTime: true,
            role: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    })

    const totalWorkedHours = workedHours.reduce((sum, wh) => sum + wh.totalHours, 0)

    // Prossimi turni
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcomingShifts = await prisma.shifts.findMany({
      where: {
        userId: requestedUserId,
        schedules: {
          weekStart: {
            gte: today,
          },
        },
      },
      select: {
        id: true,
        dayOfWeek: true,
        shiftType: true,
        startTime: true,
        endTime: true,
        role: true,
        schedules: {
          select: {
            weekStart: true,
          },
        },
      },
      orderBy: {
        schedules: {
          weekStart: 'asc',
        },
      },
      take: 10,
    })

    const upcomingShiftsWithDate = upcomingShifts.map((shift) => {
      const weekStart = shift.schedules.weekStart instanceof Date 
        ? shift.schedules.weekStart 
        : new Date(shift.schedules.weekStart)
      const shiftDate = addDays(weekStart, shift.dayOfWeek)
      return {
        id: shift.id,
        dayOfWeek: shift.dayOfWeek,
        shiftType: shift.shiftType,
        startTime: shift.startTime,
        endTime: shift.endTime,
        role: shift.role,
        date: shiftDate.toISOString(),
      }
    }).filter(shift => new Date(shift.date) >= today)

    // Estrai i ruoli secondari dal campo user_roles
    const secondaryRoles = user.user_roles
      .map(ur => ur.role)
      .filter(role => role !== user.primaryRole)

    return NextResponse.json({
      id: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      primaryRole: user.primaryRole,
      secondaryRoles,
      primaryTransport: user.primaryTransport,
      isActive: user.isActive,
      totalWorkedHours,
      totalShifts: workedHours.length,
      upcomingShifts: upcomingShiftsWithDate,
      recentHours: workedHours,
    })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json({ error: 'Errore nel recupero del profilo' }, { status: 500 })
  }
}

