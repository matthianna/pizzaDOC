import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek } from 'date-fns'
import { convertJsDayToOurDay } from '@/lib/date-utils'

// PUT /api/user/absences/[id] - Update absence
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const absenceId = resolvedParams.id

    // Controlla che l'assenza esista
    const existingAbsence = await prisma.absence.findUnique({
      where: { id: absenceId }
    })

    if (!existingAbsence) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      )
    }

    // Gli admin possono modificare qualsiasi assenza, gli utenti solo le proprie
    const isAdmin = session.user.roles.includes('ADMIN')
    if (!isAdmin && existingAbsence.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { startDate, endDate, reason, notes } = await request.json()

    const start = new Date(startDate)
    const end = new Date(endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Solo per utenti normali (non admin): non permettere di modificare assenze già iniziate
    if (!isAdmin && existingAbsence.startDate < today) {
      return NextResponse.json(
        { error: 'Non puoi modificare assenze già iniziate o nel passato' },
        { status: 400 }
      )
    }

    // Solo per utenti normali (non admin): non permettere nuove date nel passato
    if (!isAdmin && start < today) {
      return NextResponse.json(
        { error: 'Non puoi spostare l\'assenza nel passato' },
        { status: 400 }
      )
    }

    // End date deve essere >= start date
    if (end < start) {
      return NextResponse.json(
        { error: 'La data di fine deve essere successiva o uguale alla data di inizio' },
        { status: 400 }
      )
    }

    // Controlla sovrapposizioni (escludendo questa assenza) - usa userId dell'assenza, non della sessione
    const overlappingAbsences = await prisma.absence.findMany({
      where: {
        userId: existingAbsence.userId,
        id: { not: absenceId },
        OR: [
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: start } }
            ]
          }
        ]
      }
    })

    if (overlappingAbsences.length > 0) {
      return NextResponse.json(
        { error: 'Esiste già un\'assenza in questo periodo' },
        { status: 400 }
      )
    }

    const updatedAbsence = await prisma.absence.update({
      where: { id: absenceId },
      data: {
        startDate: start,
        endDate: end,
        reason: reason || null,
        notes: notes || null
      }
    })

    // Aggiorna automaticamente le disponibilità per i giorni in assenza
    // Trova tutte le settimane che si sovrappongono con l'assenza
    const weekStarts: Date[] = []
    let currentWeek = startOfWeek(start, { weekStartsOn: 1 }) // 1 = Monday
    currentWeek.setHours(0, 0, 0, 0)
    
    while (currentWeek <= end) {
      weekStarts.push(new Date(currentWeek))
      currentWeek.setDate(currentWeek.getDate() + 7)
    }

    // Per ogni giorno nell'intervallo di assenza, disabilita disponibilità
    let dayToCheck = new Date(start)
    dayToCheck.setHours(0, 0, 0, 0)
    
    while (dayToCheck <= end) {
      // Trova il lunedì di questa settimana
      const mondayOfWeek = startOfWeek(dayToCheck, { weekStartsOn: 1 })
      mondayOfWeek.setHours(0, 0, 0, 0)
      
      // Converti da JS day (0=Sunday) al nostro sistema (0=Monday)
      const jsDay = dayToCheck.getDay()
      const ourDay = convertJsDayToOurDay(jsDay)
      
      // Aggiorna disponibilità per questo giorno (sia PRANZO che CENA) - usa userId dell'assenza
      await prisma.availability.updateMany({
        where: {
          userId: existingAbsence.userId,
          weekStart: mondayOfWeek,
          dayOfWeek: ourDay, // 0=Monday, 1=Tuesday, ..., 6=Sunday
          isAvailable: true
        },
        data: {
          isAvailable: false
        }
      })
      
      // Vai al giorno successivo
      dayToCheck.setDate(dayToCheck.getDate() + 1)
    }

    return NextResponse.json(updatedAbsence)
  } catch (error) {
    console.error('Error updating absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/user/absences/[id] - Delete absence
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const absenceId = resolvedParams.id

    // Controlla che l'assenza esista
    const existingAbsence = await prisma.absence.findUnique({
      where: { id: absenceId }
    })

    if (!existingAbsence) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      )
    }

    // Gli admin possono eliminare qualsiasi assenza, gli utenti solo le proprie
    const isAdmin = session.user.roles.includes('ADMIN')
    if (!isAdmin && existingAbsence.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Solo per utenti normali (non admin): non permettere di eliminare assenze già iniziate
    if (!isAdmin && existingAbsence.startDate < today) {
      return NextResponse.json(
        { error: 'Non puoi eliminare assenze già iniziate o nel passato' },
        { status: 400 }
      )
    }

    await prisma.absence.delete({
      where: { id: absenceId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
