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

    // Ottieni TUTTI i turni delle settimane passate
    const shifts = await prisma.shifts.findMany({
      where: {
        schedules: {
          weekStart: {
            lt: today // Solo settimane passate
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

    // Filtra turni passati senza ore approvate
    const missingHours = shifts
      .filter(shift => {
        // Controlla se l'utente esiste ed è attivo
        if (!shift.user || !shift.user.isActive) return false
        
        // Calcola la data effettiva del turno
        const shiftDate = new Date(shift.schedules.weekStart)
        shiftDate.setDate(shiftDate.getDate() + shift.dayOfWeek)
        
        // IMPORTANTE: Solo turni nel PASSATO
        if (shiftDate >= today) return false
        
        // Controlla lo stato delle ore lavorate
        if (!shift.worked_hours || shift.worked_hours.length === 0) {
          // Nessuna ora inviata - MOSTRA
          return true
        }
        
        // Se ci sono ore lavorate, verifica lo stato
        const workedHours = shift.worked_hours[0]
        
        // Verifica che workedHours esista
        if (!workedHours || !workedHours.status) {
          // Nessuna ora inviata - MOSTRA
          return true
        }
        
        // ESCLUDI turni con ore APPROVATE o PENDING (già inviate)
        if (workedHours.status === 'APPROVED' || workedHours.status === 'PENDING') {
          return false
        }
        
        // INCLUDI turni con ore RIFIUTATE (devono reinviare)
        if (workedHours.status === 'REJECTED') {
          return true
        }
        
        return false
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
        weekStart: shift.schedules.weekStart,
        hoursStatus: shift.worked_hours?.[0]?.status || null
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
        weekStart: item.weekStart,
        hoursStatus: item.hoursStatus
      })
      return acc
    }, {} as Record<string, any>)

    const result = Object.values(groupedByUser).sort((a: any, b: any) => 
      a.username.localeCompare(b.username)
    )

    const rejectedCount = missingHours.filter(h => h.hoursStatus === 'REJECTED').length
    const notSubmittedCount = missingHours.filter(h => !h.hoursStatus).length
    
    console.log(`📊 [API /admin/hours-summary/missing] Totale turni trovati: ${shifts.length}`)
    console.log(`📊 [API /admin/hours-summary/missing] Turni con ore mancanti: ${missingHours.length}`)
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

