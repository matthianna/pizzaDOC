import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { logAuditAction } from '@/lib/audit-logger'

// ⚠️ IMPORTANTE: Disabilita cache per avere sempre dati aggiornati
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/admin/schedule/[weekStart] - Get schedule for a specific week
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const weekStart = normalizeDate(resolvedParams.weekStart)
    const dayMs = 24 * 60 * 60 * 1000
    const weekStartCandidates = [
      normalizeDate(new Date(weekStart.getTime() - dayMs)),
      weekStart,
      normalizeDate(new Date(weekStart.getTime() + dayMs)),
    ]

    const scheduleRows = await prisma.schedules.findMany({
      where: { weekStart: { in: weekStartCandidates } },
      include: {
        shifts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                primaryRole: true,
                primaryTransport: true,
                user_transports: {
                  select: {
                    transport: true
                  }
                }
              }
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { shiftType: 'asc' },
            { role: 'asc' }
          ]
        }
      }
    })

    const schedule =
      scheduleRows.length === 0
        ? null
        : scheduleRows.reduce((best, cur) =>
            Math.abs(cur.weekStart.getTime() - weekStart.getTime()) <=
            Math.abs(best.weekStart.getTime() - weekStart.getTime())
              ? cur
              : best
          )

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { 
          status: 404,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      )
    }

    // ⚠️ Headers anti-cache per garantire dati sempre freschi
    return NextResponse.json(schedule, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/schedule/[weekStart] - Delete schedule for a specific week
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const weekStart = normalizeDate(resolvedParams.weekStart)

    const schedule = await prisma.schedules.findUnique({
      where: { weekStart }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Conta turni prima di eliminare
    const shiftsCount = await prisma.shifts.count({
      where: { scheduleId: schedule.id }
    })

    await prisma.shifts.deleteMany({
      where: { scheduleId: schedule.id }
    })

    await prisma.schedules.delete({
      where: { id: schedule.id }
    })

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'SCHEDULE_DELETE',
      description: `Eliminato piano settimanale: ${weekStart.toISOString().split('T')[0]} (${shiftsCount} turni)`,
      metadata: {
        weekStart: weekStart.toISOString(),
        shiftsDeleted: shiftsCount
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
