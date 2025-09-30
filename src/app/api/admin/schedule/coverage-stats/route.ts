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
    const shiftLimits = await prisma.shiftLimit.findMany()
    
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
          include: {
            userRoles: true
          }
        }
      }
    })

    // 4. Calcola statistiche
    let totalRequired = 0
    let totalAssigned = 0
    let totalAvailable = 0

    // Raggruppa turni assegnati per giorno/turno/ruolo
    const assignedByKey = assignedShifts.reduce((acc, shift) => {
      const key = `${shift.dayOfWeek}-${shift.shiftType}-${shift.role}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Per ogni limite di turno, calcola required, assigned e available
    for (const limit of shiftLimits) {
      if (limit.minStaff > 0) {
        const key = `${limit.dayOfWeek}-${limit.shiftType}-${limit.role}`
        
        // Required
        totalRequired += limit.minStaff
        
        // Assigned
        const assigned = assignedByKey[key] || 0
        totalAssigned += assigned
        
        // Available (persone con il ruolo giusto disponibili per questo turno)
        const availableForThisSlot = availabilities.filter(avail => 
          avail.dayOfWeek === limit.dayOfWeek &&
          avail.shiftType === limit.shiftType &&
          avail.user.userRoles.some(role => role.role === limit.role)
        ).length
        
        totalAvailable += Math.min(availableForThisSlot, limit.minStaff) // Non contare più disponibili del necessario
      }
    }

    const coveragePercentage = totalRequired > 0 ? (totalAssigned / totalRequired) * 100 : 0
    const availabilityPercentage = totalRequired > 0 ? (totalAvailable / totalRequired) * 100 : 0

    return NextResponse.json({
      totalRequired,
      totalAssigned,
      totalAvailable,
      coveragePercentage,
      availabilityPercentage
    })

  } catch (error) {
    console.error('Error calculating coverage stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
