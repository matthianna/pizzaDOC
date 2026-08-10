import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { isAdmin } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'weekStart parameter required' }, { status: 400 })
    }

    const weekStart = normalizeDate(weekStartParam)

    // 1. Carica tutti gli utenti non admin con i loro turni e disponibilità
    const users = await prisma.user.findMany({
      where: {
        user_roles: {
          none: {
            role: 'ADMIN'
          }
        }
      },
      include: {
        shifts: {
          where: {
            schedules: {
              weekStart: weekStart
            }
          }
        },
        availabilities: {
          where: {
            weekStart: weekStart,
            isAvailable: true
          }
        }
      }
    })

    // 2. Calcola statistiche per utente
    const userStats = users.map(user => {
      const availabilitiesCount = user.availabilities.length
      const assignedCount = user.shifts.length
      const assignmentPercentage = availabilitiesCount > 0 
        ? Math.round((assignedCount / availabilitiesCount) * 100)
        : 0

      return {
        userId: user.id,
        username: user.username,
        primaryRole: user.primaryRole,
        availabilitiesEntered: availabilitiesCount,
        shiftsAssigned: assignedCount,
        assignmentPercentage
      }
    }).filter(u => u.availabilitiesEntered > 0) // Solo utenti che hanno inserito disponibilità
      .sort((a, b) => b.assignmentPercentage - a.assignmentPercentage)

    // 3. Calcola statistiche globali
    const totalAvailabilities = userStats.reduce((sum, u) => sum + u.availabilitiesEntered, 0)
    const totalAssignments = userStats.reduce((sum, u) => sum + u.shiftsAssigned, 0)
    const globalPercentage = totalAvailabilities > 0 
      ? Math.round((totalAssignments / totalAvailabilities) * 100)
      : 0

    return NextResponse.json({
      userStats,
      global: {
        totalAvailabilities,
        totalAssignments,
        assignmentPercentage: globalPercentage
      }
    })

  } catch (error) {
    console.error('Error calculating coverage stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
