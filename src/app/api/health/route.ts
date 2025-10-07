import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('[HEALTH] Health check requested')
    console.log('[HEALTH] Prisma defined:', !!prisma)
    
    // Verifica che Prisma sia definito
    if (!prisma) {
      console.error('[HEALTH] Prisma client is undefined!')
      return NextResponse.json({
        status: 'error',
        message: 'Database client not initialized',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Prova a fare una query reale al database
    console.log('[HEALTH] Attempting database query...')
    const result = await prisma.$queryRaw`SELECT 1 as health`
    console.log('[HEALTH] Database query successful:', result)

    // Conta gli utenti per verificare che il DB abbia dati
    const userCount = await prisma.user.count()
    console.log('[HEALTH] User count:', userCount)

    return NextResponse.json({
      status: 'ok',
      message: 'Database connection OK',
      userCount,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    })

  } catch (error: any) {
    console.error('[HEALTH] Database health check failed:', error)
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Database connection failed',
      timestamp: new Date().toISOString()
    }, { status: 503 })
  }
}

