import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import { it } from 'date-fns/locale'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    if (!session.user.roles.includes('ADMIN')) {
      return Response.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const body = await request.json()
    const { shiftId, reason, createSubstitution = true } = body

    if (!shiftId) {
      return Response.json({ error: 'ID turno è richiesto' }, { status: 400 })
    }

    // Trova il turno
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        user: true,
        schedule: true,
        workedHours: true
      }
    })

    if (!shift) {
      return Response.json({ error: 'Turno non trovato' }, { status: 404 })
    }

    // Controlla se ci sono già ore lavorate per questo turno
    if (shift.workedHours && shift.workedHours.status === 'APPROVED') {
      return Response.json({ 
        error: 'Non è possibile rimuovere un dipendente da un turno con ore già approvate' 
      }, { status: 400 })
    }

    // Calcola la data del turno basata su weekStart e dayOfWeek
    const weekStart = new Date(shift.schedule.weekStart)
    const shiftDate = new Date(weekStart)
    shiftDate.setDate(weekStart.getDate() + shift.dayOfWeek)

    // Controlla se è una settimana corrente o futura
    const today = new Date()
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }) // Inizia da lunedì

    if (new Date(shift.schedule.weekStart) < currentWeekStart) {
      return Response.json({ 
        error: 'Non è possibile modificare turni di settimane passate' 
      }, { status: 400 })
    }

    // Inizia transazione
    const result = await prisma.$transaction(async (tx) => {
      // Se ci sono ore lavorate pending/rejected, eliminale
      if (shift.workedHours) {
        await tx.workedHours.delete({
          where: { id: shift.workedHours.id }
        })
      }

      // Se richiesto, crea una richiesta di sostituzione
      if (createSubstitution) {
        // Calcola deadline (es. 24 ore prima del turno)
        const deadline = new Date(shiftDate)
        deadline.setHours(deadline.getHours() - 24)

        await tx.substitution.create({
          data: {
            shiftId: shift.id,
            requesterId: shift.userId,
            status: 'PENDING',
            requestNote: reason || 'Rimosso dal piano dall\'amministratore',
            deadline: deadline > new Date() ? deadline : new Date(Date.now() + 2 * 60 * 60 * 1000) // Min 2 ore
          }
        })

        // Aggiorna stato turno
        await tx.shift.update({
          where: { id: shiftId },
          data: { status: 'SUBSTITUTION_REQUESTED' }
        })
      } else {
        // Rimuovi completamente il turno
        await tx.shift.delete({
          where: { id: shiftId }
        })
      }

      return {
        action: createSubstitution ? 'substitution_created' : 'shift_removed',
        shiftId,
        userId: shift.userId,
        username: shift.user.username,
        shiftDate: format(shiftDate, 'dd/MM/yyyy', { locale: it }),
        shiftType: shift.shiftType,
        role: shift.role
      }
    })

    return Response.json(result)
  } catch (error) {
    console.error('Errore nella rimozione personale:', error)
    return Response.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// API per rimuovere un utente da tutti i turni di una settimana
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    if (!session.user.roles.includes('ADMIN')) {
      return Response.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const weekStart = searchParams.get('weekStart')
    const reason = searchParams.get('reason')

    if (!userId || !weekStart) {
      return Response.json({ error: 'UserId e weekStart sono richiesti' }, { status: 400 })
    }

    // Trova tutti i turni dell'utente per quella settimana
    const shifts = await prisma.shift.findMany({
      where: {
        userId,
        schedule: {
          weekStart: new Date(weekStart)
        }
      },
      include: {
        user: true,
        workedHours: true
      }
    })

    if (shifts.length === 0) {
      return Response.json({ error: 'Nessun turno trovato per questo utente nella settimana specificata' }, { status: 404 })
    }

    // Controlla ore approvate
    const approvedHours = shifts.filter(s => s.workedHours?.status === 'APPROVED')
    if (approvedHours.length > 0) {
      return Response.json({ 
        error: `L'utente ha ${approvedHours.length} turni con ore già approvate che non possono essere rimossi` 
      }, { status: 400 })
    }

    // Rimuovi tutti i turni in transazione
    const result = await prisma.$transaction(async (tx) => {
      // Elimina ore lavorate pending/rejected
      const workedHoursToDelete = shifts
        .filter(s => s.workedHours && s.workedHours.status !== 'APPROVED')
        .map(s => s.workedHours!.id)

      if (workedHoursToDelete.length > 0) {
        await tx.workedHours.deleteMany({
          where: {
            id: { in: workedHoursToDelete }
          }
        })
      }

      // Crea richieste di sostituzione per tutti i turni
      const substitutions = shifts.map(shift => ({
        shiftId: shift.id,
        requesterId: shift.userId,
        status: 'PENDING' as const,
        requestNote: reason || 'Rimosso dalla settimana dall\'amministratore',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 ore da ora
      }))

      await tx.substitution.createMany({
        data: substitutions
      })

      // Aggiorna stato di tutti i turni
      await tx.shift.updateMany({
        where: {
          id: { in: shifts.map(s => s.id) }
        },
        data: { status: 'SUBSTITUTION_REQUESTED' }
      })

      return {
        removedShifts: shifts.length,
        userId,
        username: shifts[0].user.username,
        weekStart: format(new Date(weekStart), 'dd/MM/yyyy', { locale: it })
      }
    })

    return Response.json(result)
  } catch (error) {
    console.error('Errore nella rimozione utente dalla settimana:', error)
    return Response.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
