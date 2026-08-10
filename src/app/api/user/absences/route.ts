import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'

// GET /api/user/absences - Get user's absences
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const absences = await prisma.absences.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        startDate: 'desc'
      }
    })

    return NextResponse.json(absences)
  } catch (error) {
    console.error('Error fetching absences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/user/absences - Create new absence
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { startDate, endDate, reason, notes } = await request.json()

    // Validazione
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const start = normalizeDate(startDate)
    const end = normalizeDate(endDate)
    const today = normalizeDate(new Date())

    // Non permettere assenze nel passato
    if (start < today) {
      return NextResponse.json(
        { error: 'Non puoi creare assenze nel passato' },
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

    // Controlla sovrapposizioni con assenze esistenti
    const overlappingAbsences = await prisma.absences.findMany({
      where: {
        userId: session.user.id,
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

    const absence = await prisma.absences.create({
      data: {
        id: crypto.randomUUID(),
        userId: session.user.id,
        startDate: start,
        endDate: end,
        reason: reason || null,
        notes: notes || null,
        updatedAt: new Date()
      }
    })

    // Availability is cleared only when an admin approves (see approve route).

    // 🔔 Invia notifica Push agli Amministratori
    try {
      const activeAdmins = await prisma.user.findMany({
        where: {
          isActive: true,
          user_roles: { some: { role: 'ADMIN' } }
        },
        select: { id: true }
      })

      const formattedStart = format(start, 'dd/MM', { locale: it })
      const formattedEnd = format(end, 'dd/MM', { locale: it })
      const dateRange = start.getTime() === end.getTime() ? formattedStart : `${formattedStart} - ${formattedEnd}`

      await Promise.allSettled(
        activeAdmins.map(admin =>
          createNotification({
            userId: admin.id,
            type: NotificationType.ABSENCE_REQUESTED,
            title: '🏖️ Nuova Richiesta Assenza',
            body: `${session.user.username} ha richiesto un'assenza per il periodo: ${dateRange}.`,
            data: {
              url: '/admin/absences',
              relatedId: absence.id
            }
          })
        )
      )
      console.log(`[Absence] Notification sent to ${activeAdmins.length} admins`)
    } catch (notificationError) {
      console.error('Error sending absence notification to admins:', notificationError)
    }

    return NextResponse.json(absence, { status: 201 })
  } catch (error) {
    console.error('Error creating absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

