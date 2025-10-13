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

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Query 1: Turni senza ORE (nessuna riga in worked_hours)
    const shiftsWithoutHours = await prisma.shifts.findMany({
      where: {
        schedules: {
          weekStart: {
            lt: today
          }
        },
        worked_hours: {
          none: {} // Nessuna riga in worked_hours
        },
        user: {
          isActive: true
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
        schedules: {
          select: {
            weekStart: true
          }
        }
      }
    })

    // Query 2: Turni con ore RIFIUTATE
    const shiftsWithRejectedHours = await prisma.shifts.findMany({
      where: {
        schedules: {
          weekStart: {
            lt: today
          }
        },
        worked_hours: {
          some: {
            status: 'REJECTED'
          }
        },
        user: {
          isActive: true
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
            status: true
          },
          where: {
            status: 'REJECTED'
          }
        },
        schedules: {
          select: {
            weekStart: true
          }
        }
      }
    })

    // Combina i risultati
    const allShifts = [...shiftsWithoutHours, ...shiftsWithRejectedHours]

    // Filtra solo turni passati e mappa
    const missingHours = allShifts
      .map(shift => {
        // Calcola la data effettiva del turno
        const shiftDate = new Date(shift.schedules.weekStart)
        shiftDate.setDate(shiftDate.getDate() + shift.dayOfWeek)
        
        return {
          shiftId: shift.id,
          userId: shift.user.id,
          username: shift.user.username,
          primaryRole: shift.user.primaryRole,
          dayOfWeek: shift.dayOfWeek,
          shiftType: shift.shiftType,
          role: shift.role,
          startTime: shift.startTime,
          endTime: shift.endTime,
          weekStart: shift.schedules.weekStart,
          shiftDate: shiftDate, // Data effettiva del turno
          hoursStatus: shift.worked_hours?.[0]?.status || null
        }
      })
      .filter(shift => {
        // Solo turni nel PASSATO
        return shift.shiftDate < today
      })

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
        endTime: item.endTime,
        weekStart: item.weekStart,
        shiftDate: item.shiftDate,
        hoursStatus: item.hoursStatus
      })
      return acc
    }, {} as Record<string, any>)

    const result = Object.values(groupedByUser).sort((a: any, b: any) => 
      a.username.localeCompare(b.username)
    )

    const rejectedCount = missingHours.filter(h => h.hoursStatus === 'REJECTED').length
    const notSubmittedCount = missingHours.filter(h => !h.hoursStatus).length
    
    console.log(`📊 [API /admin/hours-summary/missing] Query turni senza ore: ${shiftsWithoutHours.length}`)
    console.log(`📊 [API /admin/hours-summary/missing] Query turni con ore rifiutate: ${shiftsWithRejectedHours.length}`)
    console.log(`📊 [API /admin/hours-summary/missing] Totale dopo filtro passati: ${missingHours.length}`)
    console.log(`   - ❌ Ore non inviate: ${notSubmittedCount}`)
    console.log(`   - 🔴 Ore rifiutate: ${rejectedCount}`)
    console.log(`📊 [API /admin/hours-summary/missing] Utenti con turni da completare: ${result.length}`)

    return NextResponse.json({
      totalMissing: result.length,
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

