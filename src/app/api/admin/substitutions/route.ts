import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build where clause
    const where: any = {}
    if (status && status !== 'ALL') {
      where.status = status
    }

    const substitutions = await prisma.substitution.findMany({
      where,
      include: {
        shift: {
          include: {
            schedule: {
              select: {
                weekStart: true
              }
            }
          }
        },
        requester: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        substitute: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(substitutions)
  } catch (error) {
    console.error('Error fetching substitutions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}