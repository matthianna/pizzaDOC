import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-utils'
import { logAuditAction } from '@/lib/audit-logger'
import { AuditActionType } from '@prisma/client'

// Hardcoded list of tasks based on vercel.json and existing routes
const TASKS = [
    {
        id: 'availability-reminder',
        name: 'Promemoria Disponibilità',
        path: '/api/cron/availability-reminder',
        description: 'Invia notifiche WhatsApp e Push agli utenti che non hanno inserito le disponibilità per la settimana successiva.'
    },
    {
        id: 'hours-reminder',
        name: 'Promemoria Ore Lavorate',
        path: '/api/cron/hours-reminder',
        description: 'Invia promemoria agli utenti per inserire le ore lavorate della settimana corrente.'
    },
    {
        id: 'daily-backup',
        name: 'Backup Database Giornaliero',
        path: '/api/admin/database/backup',
        description: 'Crea un backup completo del database PostgreSQL e pulisce i backup più vecchi di 30 giorni.'
    }
]

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
