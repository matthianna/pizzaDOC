import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuditLogs, getAuditStats, clearAuditLogs } from '@/lib/audit-logger'
import { isAdmin } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    if (searchParams.get('stats') === '1') {
      const stats = await getAuditStats()
      return NextResponse.json(stats)
    }

    const filters = {
      userId: searchParams.get('userId') || undefined,
      action: (searchParams.get('action') as any) || undefined,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    }

    const { logs, total } = await getAuditLogs(filters)

    return NextResponse.json({
      logs,
      total,
      page: Math.floor(filters.offset / filters.limit) + 1,
      totalPages: Math.ceil(total / filters.limit),
    })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const keepBackups = body?.keepBackups !== false

    const result = await clearAuditLogs({
      keepBackups,
      actor: {
        userId: session.user.id,
        username: session.user.username,
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      keepBackups: result.keepBackups,
    })
  } catch (error: any) {
    console.error('Error clearing audit logs:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

