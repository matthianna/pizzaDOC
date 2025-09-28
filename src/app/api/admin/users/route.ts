import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/utils'

// GET /api/admin/users - Get all users
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      include: {
        userRoles: true,
        userTransports: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username, roles, primaryRole, transports, primaryTransport } = await request.json()

    if (!username || !roles || roles.length === 0 || !primaryRole) {
      return NextResponse.json(
        { error: 'Dati mancanti' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Nome utente già esistente' },
        { status: 400 }
      )
    }

    // Create user with password = username
    const hashedPassword = await hashPassword(username)

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        primaryRole,
        primaryTransport: primaryTransport || null,
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
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
