import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

// GET /api/admin/absences - Get all absences with optional filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}

    // Filtri opzionali
    if (status) {
      where.status = status
    }

    if (userId) {
      where.userId = userId
    }

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      where.OR = [
        {
          AND: [
            { startDate: { lte: end } },
            { endDate: { gte: start } }
          ]
        }
      ]
    }

    const absences = await prisma.absence.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        }
      },
      orderBy: { startDate: 'desc' }
    })

    return NextResponse.json(absences)
  } catch (error) {
    console.error('Error fetching admin absences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
