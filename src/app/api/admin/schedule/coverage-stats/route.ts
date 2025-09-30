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

    const weekStart = new Date(weekStartParam)

    // 1. Carica tutti i limiti di turno
    const shiftLimits = await prisma.shiftLimits.findMany()
    
    // 2. Carica i turni assegnati per questa settimana
    const assignedShifts = await prisma.shift.findMany({
      where: {
        schedule: {
          weekStart: weekStart
        }
      }
    })

    // 3. Carica le disponibilità per questa settimana
    const availabilities = await prisma.availability.findMany({
      where: {
        weekStart: weekStart,
        isAvailable: true
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

    // 4. Carica tutti gli utenti attivi
    const users = await prisma.user.findMany({
      where: { 
        isActive: true,
        NOT: { username: 'admin' }
      },
      select: {
        id: true,
        username: true,
        primaryRole: true
      }
    })

    // 5. Calcola stats per ogni persona
    const userStats = users.map(user => {
      // Conta disponibilità inserite
      const userAvailabilities = availabilities.filter(av => av.userId === user.id).length
      
      // Conta turni assegnati
      const userAssignedShifts = assignedShifts.filter(shift => shift.userId === user.id).length
      
      // Calcola percentuale
      const assignmentPercentage = userAvailabilities > 0 
        ? (userAssignedShifts / userAvailabilities) * 100 
        : 0

      return {
        userId: user.id,
        username: user.username,
        primaryRole: user.primaryRole,
        availabilities: userAvailabilities,
        assigned: userAssignedShifts,
        percentage: Math.round(assignmentPercentage)
      }
    })

    // Ordina per percentuale decrescente
    userStats.sort((a, b) => b.percentage - a.percentage)

    return NextResponse.json({
      userStats
    })

  } catch (error) {
    console.error('Error calculating coverage stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
