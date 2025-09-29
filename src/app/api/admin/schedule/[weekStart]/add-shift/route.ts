import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const weekStart = new Date(resolvedParams.weekStart)
    const { userId, dayOfWeek, shiftType, role, startTime } = await request.json()

    // Validazione input
    if (!userId || dayOfWeek === undefined || !shiftType || !role || !startTime) {
      return NextResponse.json(
        { error: 'Dati mancanti: userId, dayOfWeek, shiftType, role, startTime sono richiesti' },
        { status: 400 }
      )
    }

    // Verifica che l'utente esista e sia attivo
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: true
      }
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Utente non trovato o non attivo' },
        { status: 404 }
      )
    }

    // Verifica che l'utente possa fare il ruolo richiesto
    const userRoles = user.userRoles.map(ur => ur.role)
    if (!userRoles.includes(role)) {
      return NextResponse.json(
        { error: `L'utente ${user.username} non può fare il ruolo ${role}` },
        { status: 400 }
      )
    }

    // Trova o crea il schedule per questa settimana
    let schedule = await prisma.schedule.findUnique({
      where: { weekStart }
    })

    if (!schedule) {
      schedule = await prisma.schedule.create({
        data: {
          weekStart,
          generatedAt: new Date()
        }
      })
    }

    // Verifica se l'utente ha già un turno nello stesso giorno e turno
    const existingShift = await prisma.shift.findFirst({
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
    const newShift = await prisma.shift.create({
      data: {
        scheduleId: schedule.id,
        userId: userId,
        dayOfWeek: dayOfWeek,
        shiftType: shiftType,
        role: role,
        startTime: startTime,
        endTime: endTime,
        status: 'ASSIGNED'
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

