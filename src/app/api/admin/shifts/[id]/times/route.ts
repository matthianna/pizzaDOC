import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { startTime, endTime } = body

    // Valida formato orario (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: 'Formato orario non valido. Usa HH:MM' },
        { status: 400 }
      )
    }

    // Verifica che startTime sia prima di endTime
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    if (startMinutes >= endMinutes) {
      return NextResponse.json(
        { error: 'L\'orario di inizio deve essere precedente a quello di fine' },
        { status: 400 }
      )
    }

    const shift = await prisma.shifts.update({
      where: { id },
      data: {
        startTime,
        endTime
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    return NextResponse.json(shift)
  } catch (error) {
    console.error('Error updating shift times:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

