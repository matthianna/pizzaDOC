import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ScheduleAlgorithm } from '@/lib/schedule-algorithm'

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
    const algorithm = new ScheduleAlgorithm()
    
    // Generate schedule
    const result = await algorithm.generateSchedule(weekStartDate)
    
    // Save schedule
    const scheduleId = await algorithm.saveSchedule(weekStartDate, result.shifts)

    return NextResponse.json({
      scheduleId,
      shiftsGenerated: result.shifts.length,
      gaps: result.gaps
    })
  } catch (error) {
    console.error('Error generating schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
