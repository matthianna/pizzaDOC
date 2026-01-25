import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-utils'
import { logAuditAction } from '@/lib/audit-logger'
import { AuditActionType } from '@prisma/client'

// Helper function to parse cron schedule and convert to human-readable format
function parseCronSchedule(schedule: string): { readable: string; nextRun?: string } {
  // Format: "minute hour day month weekday"
  // Example: "46 13 * * 0,6" = Sunday and Saturday at 13:46
  // Example: "18 9 * * 4" = Thursday at 09:18
  
  const parts = schedule.split(' ')
  if (parts.length !== 5) {
    return { readable: schedule }
  }

  const [minute, hour, day, month, weekday] = parts
  
  // Parse weekday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  
  let readable = ''
  
  // Parse weekday
  if (weekday === '*') {
    readable = 'Ogni giorno'
  } else if (weekday.includes(',')) {
    const days = weekday.split(',').map(d => dayNames[parseInt(d)])
    readable = days.join(' e ')
  } else if (weekday.includes('-')) {
    const [start, end] = weekday.split('-').map(d => parseInt(d))
    const days = []
    for (let i = start; i <= end; i++) {
      days.push(dayNames[i])
    }
    readable = days.join(', ')
  } else {
    readable = dayNames[parseInt(weekday)]
  }
  
  // Format time
  const hourNum = parseInt(hour)
  const minuteNum = parseInt(minute)
  const timeStr = `${hourNum.toString().padStart(2, '0')}:${minuteNum.toString().padStart(2, '0')}`
  
  readable += ` alle ${timeStr}`
  
  // Calculate next run (simplified - doesn't account for all edge cases)
  const now = new Date()
  const nextRun = new Date()
  nextRun.setHours(hourNum, minuteNum, 0, 0)
  
  if (weekday !== '*') {
    const weekdays = weekday.includes(',') 
      ? weekday.split(',').map(d => parseInt(d))
      : weekday.includes('-')
        ? (() => {
            const [start, end] = weekday.split('-').map(d => parseInt(d))
            const days = []
            for (let i = start; i <= end; i++) days.push(i)
            return days
          })()
        : [parseInt(weekday)]
    
    const currentDay = now.getDay()
    const nextDay = weekdays.find(d => d >= currentDay) || weekdays[0]
    const daysUntilNext = nextDay >= currentDay ? nextDay - currentDay : (7 - currentDay) + nextDay
    
    nextRun.setDate(now.getDate() + daysUntilNext)
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 7)
    }
  } else {
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
  }
  
  return {
    readable,
    nextRun: nextRun.toISOString()
  }
}

// Hardcoded list of tasks based on vercel.json and existing routes
const TASKS = [
    {
        id: 'availability-reminder',
        name: 'Promemoria Disponibilità',
        path: '/api/cron/availability-reminder',
        schedule: '46 13 * * 0,6', // Sunday and Saturday at 13:46
        description: 'Invia notifiche WhatsApp e Push agli utenti che non hanno inserito le disponibilità per la settimana successiva.',
        type: 'notification' as const
    },
    {
        id: 'hours-reminder',
        name: 'Promemoria Ore Lavorate',
        path: '/api/cron/hours-reminder',
        schedule: '18 9 * * 4', // Thursday at 09:18
        description: 'Invia promemoria agli utenti per inserire le ore lavorate della settimana corrente.',
        type: 'notification' as const
    },
    {
        id: 'daily-backup',
        name: 'Backup Database Giornaliero',
        path: '/api/admin/database/backup',
        schedule: '0 2 * * *', // Daily at 02:00
        description: 'Crea un backup completo del database PostgreSQL e pulisce i backup più vecchi di 30 giorni.',
        type: 'backup' as const
    }
].map(task => ({
    ...task,
    ...parseCronSchedule(task.schedule)
}))

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        return NextResponse.json({ tasks: TASKS })
    } catch (error) {
        console.error('Error fetching tasks:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { taskId } = await request.json()
        const task = TASKS.find(t => t.id === taskId)

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        // Trigger the task by calling its endpoint internally
        // We use the CRON_SECRET if available
        const cronSecret = process.env.CRON_SECRET
        const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`

        console.log(`[ADMIN] Triggering task ${taskId} at ${baseUrl}${task.path}`)

        const response = await fetch(`${baseUrl}${task.path}`, {
            method: taskId === 'daily-backup' ? 'POST' : 'GET',
            headers: {
                ...(cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {}),
                'x-vercel-cron': 'true' // Simulate Vercel Cron header
            }
        })

        const result = await response.json()

        // Log the action
        await logAuditAction({
            userId: session.user.id,
            userUsername: session.user.username,
            action: 'TASK_RUN' as any,
            description: `Eseguito manualmente task: ${task.name}`,
            metadata: {
                taskId,
                success: response.ok,
                result
            }
        })

        if (!response.ok) {
            return NextResponse.json({
                error: 'Task execution failed',
                details: result
            }, { status: response.status })
        }

        return NextResponse.json({
            success: true,
            message: `Task ${task.name} eseguito con successo`,
            result
        })
    } catch (error: any) {
        console.error('Error triggering task:', error)
        return NextResponse.json({
            error: 'Internal Server Error',
            message: error.message
        }, { status: 500 })
    }
}
