import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { normalizeDate } from '@/lib/normalize-date'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'

// GET - Fetch available substitutions and user's own substitution requests
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Get available substitutions (not mine, future shifts, pending/applied status)
    const availableSubstitutions = await prisma.substitutions.findMany({
      where: {
        requesterId: {
          not: session.user.id
        },
        status: {
          in: ['PENDING', 'APPLIED']
        },
        deadline: {
          gt: now
        }
      },
      select: {
        id: true,
        shiftId: true, // ✅ Campo esplicito
        status: true,
        requestNote: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        shifts: {
          include: {
            schedules: {
              select: {
                weekStart: true
              }
            }
          }
        },
        requester: {
          select: {
            id: true,
            username: true
          }
        },
        substitute: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Filter out past shifts (considera anche l'orario di inizio)
    const futureAvailable = availableSubstitutions.filter(sub => {
      const weekStart = normalizeDate(sub.shifts.schedules.weekStart)
      // dayOfWeek è già nel formato corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica
      const shiftDate = addDays(weekStart, sub.shifts.dayOfWeek)

      // Calcola l'orario esatto di inizio del turno
      const [startHour, startMinute] = sub.shifts.startTime.split(':').map(Number)
      const shiftStartDateTime = new Date(shiftDate)
      shiftStartDateTime.setHours(startHour, startMinute, 0, 0)

      // Confronta con l'orario di inizio del turno, non solo la data
      return shiftStartDateTime > now
    })

    // Get user's own substitution requests
    const mySubstitutions = await prisma.substitutions.findMany({
      where: {
        requesterId: session.user.id
      },
      select: {
        id: true,
        shiftId: true, // ✅ Campo esplicito
        status: true,
        requestNote: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        shifts: {
          include: {
            schedules: {
              select: {
                weekStart: true
              }
            }
          }
        },
        requester: {
          select: {
            id: true,
            username: true
          }
        },
        substitute: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('📊 API Substitutions - Available:', futureAvailable.length)
    console.log('📊 API Substitutions - Mine:', mySubstitutions.length)
    if (mySubstitutions.length > 0) {
      console.log('📊 First substitution shiftId:', mySubstitutions[0].shiftId)
    }

    return NextResponse.json({
      available: futureAvailable,
      mine: mySubstitutions
    })
  } catch (error) {
    console.error('Error fetching substitutions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new substitution request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, requestNote } = await request.json()

    if (!shiftId) {
      return NextResponse.json(
        { error: 'Shift ID is required' },
        { status: 400 }
      )
    }

    // Verify the shift belongs to this user
    const shift = await prisma.shifts.findFirst({
      where: {
        id: shiftId,
        userId: session.user.id
      },
      include: {
        schedules: true
      }
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found or not assigned to you' },
        { status: 404 }
      )
    }

    // Check if shift has already started
    const weekStart = normalizeDate(shift.schedules.weekStart)
    // dayOfWeek è già nel formato corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica
    const shiftDate = addDays(weekStart, shift.dayOfWeek)

    // Parse shift start time (format: "HH:MM")
    const [startHour, startMinute] = shift.startTime.split(':').map(Number)
    const shiftStartDateTime = new Date(shiftDate)
    shiftStartDateTime.setHours(startHour, startMinute, 0, 0)

    const now = new Date()

    // ✅ Permetti sostituzioni fino all'orario di inizio del turno
    if (shiftStartDateTime <= now) {
      return NextResponse.json(
        { error: 'Il turno è già iniziato. Non è più possibile richiedere una sostituzione.' },
        { status: 400 }
      )
    }

    // Check if substitution request already exists
    const existingSubstitution = await prisma.substitutions.findFirst({
      where: {
        shiftId: shiftId,
        status: {
          in: ['PENDING', 'APPLIED', 'APPROVED']
        }
      }
    })

    if (existingSubstitution) {
      return NextResponse.json(
        { error: 'Substitution request already exists for this shift' },
        { status: 400 }
      )
    }

    // ⏰ Set deadline all'orario di inizio del turno (non più 2 ore prima)
    const deadline = shiftStartDateTime

    // Create substitution request
    const substitution = await prisma.substitutions.create({
      data: {
        id: crypto.randomUUID(),
        shiftId,
        requesterId: session.user.id,
        requestNote: requestNote || null,
        deadline,
        status: 'PENDING',
        updatedAt: new Date()
      },
      include: {
        shifts: {
          include: {
            schedules: {
              select: {
                weekStart: true
              }
            }
          }
        },
        requester: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    // 🔔 Invia notifica Push a tutti i potenziali sostituti (background)
    try {
      const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
      const dayOfWeekName = dayNames[shift.dayOfWeek]
      const formattedDate = format(shiftDate, 'dd/MM', { locale: it })

      // Trova tutti gli utenti attivi che hanno lo stesso ruolo del turno
      const potentialSubstitutes = await prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: session.user.id },
          user_roles: {
            some: {
              role: shift.role
            }
          }
        },
        select: { id: true, username: true }
      })

      console.log(`[Substitution] Broadcasting to ${potentialSubstitutes.length} potential substitutes`)

      // Crea notifiche per tutti i potenziali sostituti
      // Non usiamo Promise.all per non bloccare la risposta se sono molti
      Promise.allSettled(
        potentialSubstitutes.map(user =>
          createNotification({
            userId: user.id,
            type: NotificationType.SUBSTITUTION_REQUEST,
            title: 'Nuova Richiesta Sostituzione',
            body: `${substitution.requester.username} cerca sostituzione: ${dayOfWeekName} ${formattedDate} (${shift.shiftType})`,
            data: {
              url: '/substitution-requests',
              relatedId: substitution.id
            }
          })
        )
      ).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length
        console.log(`✅ Push broadcast completed: ${successful}/${potentialSubstitutes.length} sent`)
      }).catch(err => {
        console.error('❌ Error during push broadcast:', err)
      })

    } catch (notificationError) {
      // Log error but don't fail the request
      console.error('Error broadcasting substitution notification:', notificationError)
    }

    return NextResponse.json({
      success: true,
      substitution
    })
  } catch (error) {
    console.error('Error creating substitution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
