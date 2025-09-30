import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'
import { format } from 'date-fns'

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
    const weekStartString = format(weekStart, 'yyyy-MM-dd')

    // 1. Carica tutti gli utenti attivi (escluso admin)
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

    // 2. Carica le disponibilità per questa settimana
    const availabilities = await prisma.availability.findMany({
      where: {
        weekStart: weekStartString,
        isAvailable: true
      }
    })

    // 3. Carica i turni assegnati per questa settimana
    const assignedShifts = await prisma.shift.findMany({
      where: {
        schedule: {
          weekStart: weekStartString
        }
      }
    })

    // 4. Calcola stats per ogni utente
    const userStats = users.map(user => {
      // Conta quante disponibilità ha inserito
      const userAvailabilities = availabilities.filter(a => a.userId === user.id).length

      // Conta quanti turni gli sono stati assegnati
      const userAssignedShifts = assignedShifts.filter(s => s.userId === user.id).length

      // Calcola percentuale
      const percentage = userAvailabilities > 0 
        ? Math.round((userAssignedShifts / userAvailabilities) * 100)
        : 0

      return {
        userId: user.id,
        username: user.username,
        primaryRole: user.primaryRole,
        availabilities: userAvailabilities,
        assigned: userAssignedShifts,
        percentage
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