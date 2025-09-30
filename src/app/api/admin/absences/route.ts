import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

// GET /api/admin/absences - Get all absences
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

    if (status) {
      where.status = status
    }

    if (userId) {
      where.userId = userId
    }

    if (startDate || endDate) {
      where.OR = []
      
      if (startDate) {
        where.OR.push({
          startDate: { gte: new Date(startDate) }
        })
      }
      
      if (endDate) {
        where.OR.push({
          endDate: { lte: new Date(endDate) }
        })
      }
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
      orderBy: [
        { startDate: 'desc' },
        { createdAt: 'desc' }
      ]
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
