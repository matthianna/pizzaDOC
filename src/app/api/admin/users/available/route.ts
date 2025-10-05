import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active users with their roles and availabilities (excluding admins for scheduling)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: {
              in: ['FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO'] // Exclude ADMIN from scheduling
            }
          }
        }
      },
      include: {
        userRoles: {
          where: {
            role: {
              in: ['FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO']
            }
          }
        },
        availabilities: {
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
    const availableUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      primaryRole: user.primaryRole,
      availableRoles: user.userRoles.map(ur => ur.role),
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
