import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    
    const weekStart = new Date(weekStartParam)
    weekStart.setHours(0, 0, 0, 0)

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

    // Transform to simpler format
    const availableUsers = users.map((user: any) => ({
      id: user.id,
      username: user.username,
      primaryRole: user.primaryRole,
      availableRoles: user.user_roles.map((ur: any) => ur.role),
      availabilities: user.availabilities
    }))

    return NextResponse.json(availableUsers)
  } catch (error) {
    console.error('Error fetching available users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
