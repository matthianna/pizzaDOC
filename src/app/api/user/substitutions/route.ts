import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { normalizeDate } from '@/lib/normalize-date'
import { whatsappService } from '@/lib/whatsapp-service'

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

    // Filter out past shifts
    const futureAvailable = availableSubstitutions.filter(sub => {
      const weekStart = normalizeDate(sub.shifts.schedules.weekStart)
      // dayOfWeek è già nel formato corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica
      const shiftDate = addDays(weekStart, sub.shifts.dayOfWeek)
      return shiftDate > now
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

    // Check if shift is in the future
    const weekStart = normalizeDate(shift.schedules.weekStart)
    // dayOfWeek è già nel formato corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica
    const shiftDate = addDays(weekStart, shift.dayOfWeek)
    const now = new Date()

    if (shiftDate <= now) {
      return NextResponse.json(
        { error: 'Cannot request substitution for past shifts' },
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

    // Set deadline to 2 hours before the shift
    const deadline = new Date(shiftDate)
    deadline.setHours(deadline.getHours() - 2)

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

    // 📱 Invia notifica WhatsApp al gruppo (in background, non bloccare la risposta)
    try {
      // Recupera le impostazioni WhatsApp
      const [groupChatIdSetting, notificationsEnabledSetting] = await Promise.all([
        prisma.systemSettings.findUnique({ where: { key: 'whatsapp_group_chat_id' } }),
        prisma.systemSettings.findUnique({ where: { key: 'whatsapp_notifications_enabled' } })
      ])

      const groupChatId = groupChatIdSetting?.value
      const notificationsEnabled = notificationsEnabledSetting?.value === 'true'

      if (notificationsEnabled && groupChatId) {
        // Formatta i dati per il messaggio
        const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
        const dayOfWeekName = dayNames[shift.dayOfWeek]
        const formattedDate = format(shiftDate, 'dd/MM/yyyy', { locale: it })
        
        // Invia messaggio in background (non aspettiamo il risultato)
        whatsappService.sendGroupSubstitutionNotification({
          groupChatId,
          requesterName: substitution.requester.username,
          dayOfWeek: dayOfWeekName,
          date: formattedDate,
          shiftType: shift.shiftType,
          role: shift.role,
          startTime: shift.startTime || undefined,
          reason: requestNote || undefined
        }).then(result => {
          if (result.success) {
            console.log('✅ WhatsApp notification sent for substitution:', substitution.id)
          } else {
            console.error('❌ Failed to send WhatsApp notification:', result.error)
          }
        }).catch(error => {
          console.error('📱 WhatsApp notification error:', error)
        })
      } else {
        console.log('📱 WhatsApp notifications disabled or not configured')
      }
    } catch (whatsappError) {
      // Log error but don't fail the request
      console.error('Error sending WhatsApp notification:', whatsappError)
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
