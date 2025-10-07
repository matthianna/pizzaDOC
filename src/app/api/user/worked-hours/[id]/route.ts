import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT - Update rejected worked hours
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, startTime, endTime, totalHours } = await request.json()

    if (!shiftId || !startTime || !endTime || typeof totalHours !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify the worked hours record exists and belongs to this user
    const existingWorkedHours = await prisma.worked_hours.findFirst({
      where: {
        id: id,
        userId: session.user.id,
        status: 'REJECTED' // Only allow updates on rejected hours
      },
      include: {
        shift: true
      }
    })

    if (!existingWorkedHours) {
      return NextResponse.json(
        { error: 'Rejected worked hours record not found or not updatable' },
        { status: 404 }
      )
    }

    // Verify the shift matches
    if (existingWorkedHours.shiftId !== shiftId) {
      return NextResponse.json(
        { error: 'Shift ID mismatch' },
        { status: 400 }
      )
    }

    // Validate time format and logic
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: 'Invalid time format' },
        { status: 400 }
      )
    }

    // Handle overnight shifts (e.g., 22:00 to 00:30)
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    let endMinutes = endHour * 60 + endMin
    
    // If end time is earlier than start time, assume it's the next day
    if (endHour < startHour) {
      endMinutes += 24 * 60 // Add 24 hours
    }
    
    const calculatedMinutes = endMinutes - startMinutes
    const calculatedHours = Math.round((calculatedMinutes / 60) * 2) / 2

    if (calculatedHours <= 0) {
      return NextResponse.json(
        { error: 'Invalid time range' },
        { status: 400 }
      )
    }

    if (Math.abs(calculatedHours - totalHours) > 0.01) {
      return NextResponse.json(
        { error: 'Total hours calculation mismatch' },
        { status: 400 }
      )
    }

    // Update worked hours record
    const updatedWorkedHours = await prisma.worked_hours.update({
      where: { id: id },
      data: {
        startTime,
        endTime,
        totalHours: calculatedHours,
        status: 'PENDING', // Reset to pending for re-approval
        rejectionReason: null, // Clear rejection reason
        submittedAt: new Date(),
        reviewedAt: null // Clear previous review
      }
    })

    return NextResponse.json({
      success: true,
      worked_hours: updatedWorkedHours
    })
  } catch (error) {
    console.error('Error updating worked hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
