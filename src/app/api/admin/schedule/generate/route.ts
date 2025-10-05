import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaxCoverageAlgorithm } from '@/lib/max-coverage-algorithm'
import { prisma } from '@/lib/prisma'

async function saveSchedule(weekStart: Date, shifts: any[]): Promise<string> {
  // Elimina schedule esistente se presente
  const existingSchedule = await prisma.schedule.findUnique({
    where: { weekStart },
    include: { shifts: true }
  })

  if (existingSchedule) {
    await prisma.shift.deleteMany({
      where: { scheduleId: existingSchedule.id }
    })
    await prisma.schedule.delete({
      where: { id: existingSchedule.id }
    })
  }

  // Crea nuovo schedule
  const schedule = await prisma.schedule.create({
    data: {
      weekStart,
      shifts: {
        create: shifts.map(shift => ({
          userId: shift.userId,
          dayOfWeek: shift.dayOfWeek,
          shiftType: shift.shiftType,
          role: shift.role,
          startTime: shift.startTime,
          endTime: shift.endTime
        }))
      }
    }
  })

  return schedule.id
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { weekStart } = await request.json()

    if (!weekStart) {
      return NextResponse.json(
        { error: 'Week start required' },
        { status: 400 }
      )
    }

    const weekStartDate = new Date(weekStart)
    const algorithm = new MaxCoverageAlgorithm()
    
    // Generate max coverage schedule
    const result = await algorithm.generateMaxCoverageSchedule(weekStartDate)
    
    // Save schedule
    const scheduleId = await saveSchedule(weekStartDate, result.shifts)

    return NextResponse.json({
      scheduleId,
      shiftsGenerated: result.shifts.length,
      gaps: result.statistics.gaps,
      statistics: {
        totalShifts: result.statistics.totalShifts,
        rolesAssigned: result.statistics.rolesAssigned,
        quality: result.statistics.quality
      }
    })
  } catch (error) {
    console.error('Error generating schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
