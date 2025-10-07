import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'
import { normalizeDate } from '@/lib/normalize-date'

// GET /api/admin/absences - Get all absences (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status') // 'past', 'active', 'future'

    const today = normalizeDate(new Date())

    let whereClause: Record<string, unknown> = {}

    // Filtro per utente
    if (userId) {
      whereClause.userId = userId
    }

    // Filtro per status
    if (status === 'past') {
      whereClause.endDate = { lt: today }
    } else if (status === 'active') {
      whereClause.AND = [
        { startDate: { lte: today } },
        { endDate: { gte: today } }
      ]
    } else if (status === 'future') {
      whereClause.startDate = { gt: today }
    }

    const absences = await prisma.absences.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    })

    return NextResponse.json(absences)
  } catch (error) {
    console.error('Error fetching absences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
