import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

interface UserInfo {
  id: string
  username: string
}

// GET /api/admin/missing-availability - Check which employees haven't submitted availability
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

    // Get all non-admin active users
    const allUsers = await prisma.user.findMany({
      where: {
        isActive: true, // Only active users
        user_roles: {
          none: {
            role: 'ADMIN'
          }
        }
      },
      select: {
        id: true,
        username: true
      }
    })

    // Get users who have submitted availability for this week
    const usersWithAvailability = await prisma.availabilities.findMany({
      where: {
        weekStart: weekStart
      },
      select: {
        userId: true,
        user: {
          select: {
            username: true
          }
        }
      },
      distinct: ['userId']
    })

    // Create set of user IDs who have submitted availability
    const usersWithAvailabilityIds = new Set(
      usersWithAvailability.map(a => a.userId)
    )

    // Find users who haven't submitted availability
    const missingUsers = allUsers
      .filter((user: UserInfo) => !usersWithAvailabilityIds.has(user.id))
      .map((user: UserInfo) => user.username)

    // Calculate completion percentage
    const totalUsers = allUsers.length
    const usersWithData = usersWithAvailability.length
    const completionPercentage = totalUsers > 0 ? Math.round((usersWithData / totalUsers) * 100) : 0

    return NextResponse.json({
      missingUsers,
      totalUsers,
      usersWithAvailability: usersWithData,
      completionPercentage,
      weekStart: weekStart.toISOString()
    })

  } catch (error) {
    console.error('Error checking missing availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
