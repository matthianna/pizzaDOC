import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // Controlla che l'assenza esista e appartenga all'utente
    const existingAbsence = await prisma.absence.findUnique({
      where: { id: absenceId }
    })

    if (!existingAbsence) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      )
    }

    if (existingAbsence.userId !== session.user.id) {
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

    // Non permettere di modificare assenze che sono già iniziate
    if (existingAbsence.startDate < today) {
      return NextResponse.json(
        { error: 'Non puoi modificare assenze già iniziate o nel passato' },
        { status: 400 }
      )
    }

    // Non permettere nuove date nel passato
    if (start < today) {
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

    // Controlla sovrapposizioni (escludendo questa assenza)
    const overlappingAbsences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
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
    let currentDate = new Date(start)
    currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 1) // Vai al lunedì
    currentDate.setHours(0, 0, 0, 0)
    
    while (currentDate <= end) {
      weekStarts.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 7)
    }

    // Per ogni settimana, trova i giorni in assenza e aggiorna disponibilità
    for (const weekStart of weekStarts) {
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(weekStart)
        currentDay.setDate(currentDay.getDate() + i)
        currentDay.setHours(0, 0, 0, 0)
        
        // Verifica se questo giorno è nell'intervallo dell'assenza
        if (currentDay >= start && currentDay <= end) {
          // Aggiorna disponibilità per questo giorno (sia PRANZO che CENA)
          await prisma.availability.updateMany({
            where: {
              userId: session.user.id,
              weekStart: weekStart,
              dayOfWeek: i, // 0=Monday, 1=Tuesday, ..., 6=Sunday
              isAvailable: true
            },
            data: {
              isAvailable: false
            }
          })
        }
      }
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

    // Controlla che l'assenza esista e appartenga all'utente
    const existingAbsence = await prisma.absence.findUnique({
      where: { id: absenceId }
    })

    if (!existingAbsence) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      )
    }

    if (existingAbsence.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Non permettere di eliminare assenze già iniziate
    if (existingAbsence.startDate < today) {
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
