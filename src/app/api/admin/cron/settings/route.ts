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

    // Get cron schedule from database
    const cronScheduleSetting = await prisma.systemSettings.findUnique({
      where: { key: 'cron_availability_schedule' }
    })

    const cronEnabledSetting = await prisma.systemSettings.findUnique({
      where: { key: 'cron_availability_enabled' }
    })

    return NextResponse.json({
      schedule: cronScheduleSetting?.value || '0 12 * * 0', // Default: Sunday at 12:00 UTC
      enabled: cronEnabledSetting?.value === 'true',
      // Vercel.json actual schedule (can't be modified dynamically)
      vercelSchedule: '0 12 * * 0'
    })
  } catch (error) {
    console.error('Error fetching cron settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { schedule, enabled } = await request.json()

    // Update cron schedule in database
    if (schedule !== undefined) {
      await prisma.systemSettings.upsert({
        where: { key: 'cron_availability_schedule' },
        update: { value: schedule },
        create: { key: 'cron_availability_schedule', value: schedule }
      })
    }

    if (enabled !== undefined) {
      await prisma.systemSettings.upsert({
        where: { key: 'cron_availability_enabled' },
        update: { value: enabled ? 'true' : 'false' },
        create: { key: 'cron_availability_enabled', value: enabled ? 'true' : 'false' }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Cron settings updated successfully',
      note: 'To apply the new schedule, update vercel.json and redeploy'
    })
  } catch (error) {
    console.error('Error updating cron settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

