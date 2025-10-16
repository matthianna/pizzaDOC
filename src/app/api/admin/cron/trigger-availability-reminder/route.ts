import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Trigger cron job
    const cronUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/cron/availability-reminder`
      : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cron/availability-reminder`

    console.log('🚀 Triggering cron job at:', cronUrl)

    const cronResponse = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    })

    const cronData = await cronResponse.json()

    if (!cronResponse.ok) {
      console.error('❌ Cron job failed:', cronData)
      return NextResponse.json(
        { 
          error: 'Cron job failed',
          details: cronData
        },
        { status: cronResponse.status }
      )
    }

    console.log('✅ Cron job executed successfully:', cronData)

    return NextResponse.json({
      success: true,
      message: 'Cron job triggered successfully',
      data: cronData
    })
  } catch (error) {
    console.error('Error triggering cron job:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

