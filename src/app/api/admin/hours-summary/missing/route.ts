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

    // Ottieni TUTTI i turni senza filtro per settimana
    const shifts = await prisma.shifts.findMany({
      where: {
        // Solo turni passati o della settimana corrente
        schedules: {
          weekStart: {
            lte: new Date() // Settimane fino ad oggi
          }
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
        },
        schedules: {
          select: {
            weekStart: true
          }
        }
      },
      orderBy: {
        schedules: {
          weekStart: 'desc'
        }
      }
    })

    // Filtra solo turni senza ore inviate e utenti attivi
    const missingHours = shifts
      .filter(shift => {
        // Controlla se l'utente esiste ed è attivo
        if (!shift.user || !shift.user.isActive) return false
        
        // Controlla se non ci sono ore lavorate (null o array vuoto)
        const hasNoWorkedHours = !shift.worked_hours || shift.worked_hours.length === 0
        
        return hasNoWorkedHours
      })
      .map(shift => ({
        shiftId: shift.id,
        userId: shift.user.id,
        username: shift.user.username,
        primaryRole: shift.user.primaryRole,
        dayOfWeek: shift.dayOfWeek,
        shiftType: shift.shiftType,
        role: shift.role,
        startTime: shift.startTime,
        endTime: shift.endTime,
        weekStart: shift.schedules.weekStart
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
        endTime: item.endTime,
        weekStart: item.weekStart
      })
      return acc
    }, {} as Record<string, any>)

    const result = Object.values(groupedByUser).sort((a: any, b: any) => 
      a.username.localeCompare(b.username)
    )

    console.log(`📊 [API /admin/hours-summary/missing] Trovati ${shifts.length} turni totali`)
    console.log(`📊 [API /admin/hours-summary/missing] ${missingHours.length} turni senza ore inviate`)
    console.log(`📊 [API /admin/hours-summary/missing] ${result.length} utenti con ore mancanti`)

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

