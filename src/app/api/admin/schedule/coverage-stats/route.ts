import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

    const weekStart = weekStartParam

    // 1. Carica tutti gli utenti con i loro ruoli
    const users = await prisma.user.findMany({
      where: {
        roles: {
          not: 'ADMIN'
        }
      },
      include: {
        userRoles: true
      }
    })

    // 2. Carica le disponibilità per questa settimana
    const availabilities = await prisma.availability.findMany({
      where: {
        weekStart: weekStart,
        isAvailable: true,
        isAbsentWeek: false
      }
    })

    // 3. Carica i turni assegnati per questa settimana
    const assignedShifts = await prisma.shift.findMany({
      where: {
        schedule: {
          weekStart: weekStart
        },
        userId: {
          not: null
        }
      }
    })

    // 4. Calcola statistiche per utente
    const userStats = users.map(user => {
      // Disponibilità inserite dall'utente
      const userAvailabilities = availabilities.filter(a => a.userId === user.id)
      
      // Turni assegnati all'utente
      const userShifts = assignedShifts.filter(s => s.userId === user.id)
      
      // Percentuale di assegnazione: (turni assegnati / disponibilità) * 100
      const availabilityCount = userAvailabilities.length
      const assignedCount = userShifts.length
      const assignmentPercentage = availabilityCount > 0 
        ? (assignedCount / availabilityCount) * 100 
        : 0

      return {
        userId: user.id,
        username: user.username,
        primaryRole: user.primaryRole,
        availabilitiesEntered: availabilityCount,
        shiftsAssigned: assignedCount,
        assignmentPercentage: Math.round(assignmentPercentage)
      }
    })

    // 5. Calcola statistiche globali
    const totalAvailabilities = availabilities.length
    const totalAssignments = assignedShifts.length
    const globalPercentage = totalAvailabilities > 0 
      ? (totalAssignments / totalAvailabilities) * 100 
      : 0

    return NextResponse.json({
      userStats: userStats.sort((a, b) => b.assignmentPercentage - a.assignmentPercentage),
      global: {
        totalAvailabilities,
        totalAssignments,
        assignmentPercentage: Math.round(globalPercentage)
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