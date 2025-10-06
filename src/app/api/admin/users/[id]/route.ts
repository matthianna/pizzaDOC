import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    await prisma.userRole.deleteMany({
      where: { userId: id }
    })

    await prisma.userTransport.deleteMany({
      where: { userId: id }
    })

    // Update user with new data
    const user = await prisma.user.update({
      where: { id: id },
      data: {
        primaryRole,
        primaryTransport: primaryTransport || null,
        isActive,
        userRoles: {
          create: roles.map((role: string) => ({ role }))
        },
        userTransports: transports?.length > 0 ? {
          create: transports.map((transport: string) => ({ transport }))
        } : undefined
      },
      include: {
        userRoles: true,
        userTransports: true
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
    const user = await prisma.user.findUnique({
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

    await prisma.user.delete({
      where: { id: id }
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
