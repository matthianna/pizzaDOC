import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'weekStart parameter required' }, { status: 400 })
    }

    const weekStart = normalizeDate(weekStartParam)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    console.log(`🔍 Cercando disponibilità per weekStart: ${weekStart.toISOString()}`)

    // Carica tutti gli utenti attivi (no admin) con le loro disponibilità
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        user_roles: {
          none: {
            role: 'ADMIN'
          }
        }
      },
      include: {
        availabilities: {
          where: {
            weekStart: {
              gte: weekStart,
              lt: new Date(weekStart.getTime() + 24 * 60 * 60 * 1000) // Stesso giorno
            }
          }
        },
        absences: {
          where: {
            OR: [
              {
                AND: [
                  { startDate: { lte: weekEnd } },
                  { endDate: { gte: weekStart } }
                ]
              }
            ]
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    })

    const usersAvailability = users.map(user => ({
      userId: user.id,
      username: user.username,
      primaryRole: user.primaryRole,
      availabilities: user.availabilities.map(av => ({
        dayOfWeek: av.dayOfWeek,
        shiftType: av.shiftType,
        isAvailable: av.isAvailable
      })),
      absences: user.absences.map(abs => ({
        id: abs.id,
        startDate: abs.startDate.toISOString(),
        endDate: abs.endDate.toISOString(),
        reason: abs.reason
      }))
    }))

    console.log(`✅ Trovati ${users.length} utenti`)
    console.log(`📊 Disponibilità totali: ${users.reduce((sum, u) => sum + u.availabilities.length, 0)}`)

    return NextResponse.json({
      users: usersAvailability,
      weekStart: weekStart.toISOString()
    })
  } catch (error) {
    console.error('Error fetching availability overview:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

