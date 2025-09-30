import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

// GET /api/admin/absences - Get all absences
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const absences = await prisma.absence.findMany({
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
        { user: { username: 'asc' } }
      ]
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
