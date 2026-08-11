import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { expireSubstitutionsPastDeadline } from '@/lib/substitution-expiry'
import { SubstitutionStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await expireSubstitutionsPastDeadline()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: {
      status?: SubstitutionStatus
    } = {}
    if (status && status !== 'ALL') {
      where.status = status as SubstitutionStatus
    }

    const substitutions = await prisma.substitutions.findMany({
      where,
      include: {
        shifts: {
          include: {
            schedules: {
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