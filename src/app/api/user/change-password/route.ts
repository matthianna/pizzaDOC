import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    console.log('User change password API called')
    
    // Get JWT token directly from the request
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    console.log('Token found:', !!token)
    console.log('User ID from token:', token?.id)
    
    if (!token || !token.id) {
      console.log('No token or user ID found')
      return NextResponse.json(
        { error: 'Non autorizzato - token non valido' },
        { status: 401 }
      )
    }

    const { userId, newPassword } = await request.json()
    console.log('Request data - userId:', userId, 'passwordLength:', newPassword?.length)

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'Dati mancanti' },
        { status: 400 }
      )
    }

    // Verifica che l'utente possa modificare solo la propria password
    if (token.id !== userId) {
      console.log('User trying to change someone else password:', token.id, '!=', userId)
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

    console.log('Hashing new password...')
    const hashedPassword = await hashPassword(newPassword)
    
    console.log('Updating user in database...')
    const updatedUser = await prisma.User.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        isFirstLogin: false
      }
    })

    console.log('Password updated successfully for user:', updatedUser.id)

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
