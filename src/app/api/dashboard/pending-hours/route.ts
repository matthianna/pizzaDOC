import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ⚠️ IMPORTANTE: Disabilita cache per avere sempre dati aggiornati
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Solo gli admin possono accedere a questa API
    if (!session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Trova tutte le ore in attesa raggruppate per utente
    const pendingHours = await prisma.worked_hours.findMany({
      where: {
        status: 'PENDING'
      },
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
            startTime: true,
            endTime: true,
            schedules: {
              select: {
                weekStart: true
              }
            }
          }
        }
      },
      orderBy: [
        { submittedAt: 'asc' }
      ]
    })

    // Raggruppa per utente
    const usersPending = pendingHours.reduce((acc, workedHour) => {
      const userId = workedHour.user.id
      if (!acc[userId]) {
        acc[userId] = {
          user: workedHour.user,
          pendingShifts: [],
          totalHours: 0,
          shiftsCount: 0
        }
      }
      
      acc[userId].pendingShifts.push({
        id: workedHour.id,
        shiftId: workedHour.shiftId,
        startTime: workedHour.startTime,
        endTime: workedHour.endTime,
        totalHours: workedHour.totalHours,
        submittedAt: workedHour.submittedAt,
        shift: workedHour.shifts
      })
      
      acc[userId].totalHours += workedHour.totalHours
      acc[userId].shiftsCount += 1
      
      return acc
    }, {} as Record<string, any>)

    // Converte l'oggetto in array e ordina per numero di turni in attesa (decrescente)
    const pendingUsersList = Object.values(usersPending).sort((a: any, b: any) => 
      b.shiftsCount - a.shiftsCount
    )

    // ⚠️ Headers anti-cache per garantire dati sempre freschi
    return NextResponse.json({
      users: pendingUsersList,
      totalUsers: pendingUsersList.length,
      totalShifts: pendingHours.length,
      totalHours: pendingHours.reduce((sum, wh) => sum + wh.totalHours, 0)
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching pending hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
