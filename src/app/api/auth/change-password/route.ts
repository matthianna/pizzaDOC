import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    console.log('Change password API called')
    const session = await getServerSession(authOptions)
    
    console.log('Session found:', !!session)
    console.log('User in session:', session?.user?.id)
    
    if (!session || !session.user) {
      console.log('No session or user found')
      return NextResponse.json(
        { error: 'Non autorizzato - sessione non trovata' },
        { status: 401 }
      )
    }

    const { userId, newPassword } = await request.json()

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'Dati mancanti' },
        { status: 400 }
      )
    }

    // Verifica che l'utente possa modificare solo la propria password
    if (session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Non autorizzato a modificare questa password' },
        { status: 403 }
      )
    }

    // Validazione password
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La password deve essere di almeno 6 caratteri' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(newPassword)

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        isFirstLogin: false
      }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Password aggiornata con successo'
    })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}
