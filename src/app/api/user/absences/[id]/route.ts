import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

// PUT /api/user/absences/[id] - Update absence
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const resolvedParams = await params
    const absenceId = resolvedParams.id

    // Controlla che l'assenza esista
    const existingAbsence = await prisma.absences.findUnique({
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
        { error: 'Non autorizzato' },
        { status: 403 }
      )
    }

    // Solo per utenti normali (non admin): non modificare assenze già approvate
    if (!isAdmin && existingAbsence.approved) {
      return NextResponse.json(
        { error: 'Non puoi modificare un\'assenza già approvata' },
        { status: 400 }
      )
    }

    const { startDate, endDate, reason, notes } = await request.json()

    const start = normalizeDate(startDate)
    const end = normalizeDate(endDate)
    const today = normalizeDate(new Date())

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
    const overlappingAbsences = await prisma.absences.findMany({
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

    const updatedAbsence = await prisma.absences.update({
      where: { id: absenceId },
      data: {
        startDate: start,
        endDate: end,
        reason: reason || null,
        notes: notes || null,
        // Re-submit requires new admin approval if dates/content changed
        ...(!isAdmin
          ? { approved: false, approvedBy: null, updatedAt: new Date() }
          : { updatedAt: new Date() }),
      }
    })

    // Availability is cleared only on admin approval.

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
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const resolvedParams = await params
    const absenceId = resolvedParams.id

    // Controlla che l'assenza esista
    const existingAbsence = await prisma.absences.findUnique({
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
        { error: 'Non autorizzato' },
        { status: 403 }
      )
    }

    const today = normalizeDate(new Date())

    // Solo per utenti normali (non admin): non permettere di eliminare assenze già iniziate o approvate
    if (!isAdmin && existingAbsence.approved) {
      return NextResponse.json(
        { error: 'Non puoi eliminare un\'assenza già approvata' },
        { status: 400 }
      )
    }

    if (!isAdmin && existingAbsence.startDate < today) {
      return NextResponse.json(
        { error: 'Non puoi eliminare assenze già iniziate o nel passato' },
        { status: 400 }
      )
    }

    await prisma.absences.delete({
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
