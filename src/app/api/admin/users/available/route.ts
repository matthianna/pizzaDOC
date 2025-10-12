import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ottieni weekStart dalla query string
    const { searchParams } = new URL(req.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'weekStart parameter is required' }, { status: 400 })
    }
    
    // ⭐ USA normalizeDate per UTC consistency (come tutti gli altri endpoint!)
    const weekStart = normalizeDate(weekStartParam)
    
    console.log(`🔍 [API /api/admin/users/available] Richiesta per settimana: ${weekStart.toISOString()}`)

    // Fetch all active users with their roles and availabilities FOR THIS SPECIFIC WEEK (excluding admins for scheduling)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        user_roles: {
          some: {
            role: {
              in: ['FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO'] // Exclude ADMIN from scheduling
            }
          }
        }
      },
      include: {
        user_roles: {
          where: {
            role: {
              in: ['FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO']
            }
          }
        },
        availabilities: {
          where: {
            weekStart: weekStart // ⭐ FILTRA PER SETTIMANA SPECIFICA!
          },
          select: {
            dayOfWeek: true,
            shiftType: true,
            isAvailable: true
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    })

    console.log(`✅ [API] Utenti trovati: ${users.length}`)
    
    // Transform to simpler format
    const availableUsers = users.map((user: any) => ({
      id: user.id,
      username: user.username,
      primaryRole: user.primaryRole,
      availableRoles: user.user_roles.map((ur: any) => ur.role),
      availabilities: user.availabilities
    }))
    
    // Log dettagliato disponibilità
    const totalAvailabilities = availableUsers.reduce((sum: number, u: any) => sum + u.availabilities.length, 0)
    const usersWithAvailabilities = availableUsers.filter((u: any) => u.availabilities.length > 0).length
    console.log(`✅ [API] Disponibilità trovate: ${totalAvailabilities} totali`)
    console.log(`✅ [API] Utenti con disponibilità: ${usersWithAvailabilities}/${users.length}`)
    
    if (usersWithAvailabilities === 0) {
      console.warn(`⚠️  [API] NESSUN utente ha disponibilità per ${weekStart.toISOString().split('T')[0]}!`)
    }

    return NextResponse.json(availableUsers)
  } catch (error) {
    console.error('Error fetching available users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
