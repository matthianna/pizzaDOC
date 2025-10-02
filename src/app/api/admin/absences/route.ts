import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

// GET /api/admin/absences - Get all absences (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type')

    const absences = await prisma.absence.findMany({
      where: {
        ...(userId && { userId }),
        ...(type && { type: type as any })
      },
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
    console.error('Error fetching absences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

