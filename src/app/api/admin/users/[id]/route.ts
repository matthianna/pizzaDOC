import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'

// GET /api/admin/users/[id] - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.User.findUnique({
      where: { id },
      include: {
        user_roles: true,
        user_transports: true,
        shifts: {
          include: {
            schedules: true
          },
          orderBy: {
            schedules: {
              weekStart: 'desc'
            }
          },
          take: 10
        },
        worked_hours: {
          include: {
            shifts: {
              include: {
                schedules: true
              }
            }
          },
          orderBy: {
            submittedAt: 'desc'
          },
          take: 10
        },
        absences: {
          orderBy: {
            startDate: 'desc'
          },
          take: 10
        },
        requestedSubstitutions: {
          include: {
            shifts: {
              include: {
                schedules: true
              }
            },
            substitute: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles, primaryRole, transports, primaryTransport, isActive } = await request.json()

    if (!roles || roles.length === 0 || !primaryRole) {
      return NextResponse.json(
        { error: 'Dati mancanti' },
        { status: 400 }
      )
    }

    // Delete existing roles and transports
    await prisma.user_roles.deleteMany({
      where: { userId: id }
    })

    await prisma.user_transports.deleteMany({
      where: { userId: id }
    })

    // Update user with new data
    const user = await prisma.User.update({
      where: { id: id },
      data: {
        primaryRole,
        primaryTransport: primaryTransport || null,
        isActive,
        updatedAt: new Date(),
        user_roles: {
          create: roles.map((role: string) => ({ 
            id: crypto.randomUUID(),
            role 
          }))
        },
        user_transports: transports?.length > 0 ? {
          create: transports.map((transport: string) => ({ 
            id: crypto.randomUUID(),
            transport 
          }))
        } : undefined
      },
      include: {
        user_roles: true,
        user_transports: true
      }
    })

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'USER_EDIT',
      description: `Modificato utente: ${user.username}`,
      metadata: {
        userId: user.id,
        roles: roles,
        primaryRole: primaryRole,
        transports: transports || [],
        isActive: isActive
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user exists
    const user = await prisma.User.findUnique({
      where: { id: id }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    // Prevent self-deletion
    if (user.id === session.user.id) {
      return NextResponse.json(
        { error: 'Non puoi eliminare il tuo account' },
        { status: 400 }
      )
    }

    await prisma.User.delete({
      where: { id: id }
    })

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'USER_DELETE',
      description: `Eliminato utente: ${user.username}`,
      metadata: {
        userId: user.id,
        username: user.username
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
