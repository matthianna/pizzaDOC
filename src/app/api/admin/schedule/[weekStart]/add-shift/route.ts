import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const weekStart = normalizeDate(resolvedParams.weekStart)
    const { userId, dayOfWeek, shiftType, role, startTime } = await request.json()

    // Validazione input
    if (!userId || dayOfWeek === undefined || !shiftType || !role || !startTime) {
      return NextResponse.json(
        { error: 'Dati mancanti: userId, dayOfWeek, shiftType, role, startTime sono richiesti' },
        { status: 400 }
      )
    }

    // Verifica che l'utente esista e sia attivo
    const user = await prisma.User.findUnique({
      where: { id: userId },
      include: {
        user_roles: true
      }
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Utente non trovato o non attivo' },
        { status: 404 }
      )
    }

    // Verifica che l'utente possa fare il ruolo richiesto
    const user_roles = user.user_roles.map(ur => ur.role)
    if (!user_roles.includes(role)) {
      return NextResponse.json(
        { error: `L'utente ${user.username} non può fare il ruolo ${role}` },
        { status: 400 }
      )
    }

    // Trova o crea il schedule per questa settimana
    let schedule = await prisma.schedules.findUnique({
      where: { weekStart }
    })

    if (!schedule) {
      schedule = await prisma.schedules.create({
        data: {
          id: crypto.randomUUID(),
          weekStart,
          updatedAt: new Date()
        }
      })
    }

    // Verifica se l'utente ha già un turno nello stesso giorno e turno
    const existingShift = await prisma.shifts.findFirst({
      where: {
        scheduleId: schedule.id,
        userId: userId,
        dayOfWeek: dayOfWeek,
        shiftType: shiftType
      }
    })

    if (existingShift) {
      return NextResponse.json(
        { error: `${user.username} ha già un turno ${shiftType.toLowerCase()} in questo giorno` },
        { status: 400 }
      )
    }

    // Determina l'orario di fine fisso in base al turno
    const endTime = shiftType === 'PRANZO' ? '14:00' : '22:00'

    // Crea il nuovo turno
    const newShift = await prisma.shifts.create({
      data: {
        id: crypto.randomUUID(),
        scheduleId: schedule.id,
        userId: userId,
        dayOfWeek: dayOfWeek,
        shiftType: shiftType,
        role: role,
        startTime: startTime,
        endTime: endTime,
        status: 'ASSIGNED',
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      shift: newShift,
      message: `Turno aggiunto: ${user.username} - ${shiftType.toLowerCase()} (${role.toLowerCase()})`
    })
  } catch (error) {
    console.error('Error adding manual shift:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}

