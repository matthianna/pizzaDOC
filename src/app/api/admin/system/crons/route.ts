import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-utils'
import { logAuditAction } from '@/lib/audit-logger'

// Hardcoded list of crons based on vercel.json and existing routes
const CRONS = [
    {
        id: 'availability-reminder',
        name: 'Promemoria Disponibilità',
        path: '/api/cron/availability-reminder',
        schedule: '0 15 * * 6', // Sabato alle 15:00 UTC
        description: 'Invia notifiche WhatsApp e Push agli utenti che non hanno inserito le disponibilità per la settimana successiva.'
    },
    {
        id: 'hours-reminder',
        name: 'Promemoria Ore Lavorate',
        path: '/api/cron/hours-reminder',
        schedule: '18 9 * * 4', // Giovedì alle 9:18 UTC
        description: 'Invia promemoria agli utenti per inserire le ore lavorate della settimana corrente.'
    },
    {
        id: 'daily-backup',
        name: 'Backup Database Giornaliero',
        path: '/api/cron/daily-backup',
        schedule: '0 2 * * *', // Ogni giorno alle 2:00 AM
        description: 'Crea un backup completo del database PostgreSQL e pulisce i backup più vecchi di 30 giorni.'
    }
]

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        return NextResponse.json({ crons: CRONS })
    } catch (error) {
        console.error('Error fetching crons:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { cronId } = await request.json()
        const cron = CRONS.find(c => c.id === cronId)

        if (!cron) {
            return NextResponse.json({ error: 'Cron not found' }, { status: 404 })
        }

        // Trigger the cron by calling its endpoint internally
        // We use the CRON_SECRET if available
        const cronSecret = process.env.CRON_SECRET
        const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`

        console.log(`[ADMIN] Triggering cron ${cronId} at ${baseUrl}${cron.path}`)

        const response = await fetch(`${baseUrl}${cron.path}`, {
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
            action: 'CRON_RUN',
            description: `Eseguito manualmente cron job: ${cron.name}`,
            metadata: {
                cronId,
                success: response.ok,
                result
            }
        })

        if (!response.ok) {
            return NextResponse.json({
                error: 'Cron execution failed',
                details: result
            }, { status: response.status })
        }

        return NextResponse.json({
            success: true,
            message: `Cron ${cron.name} eseguito con successo`,
            result
        })
    } catch (error: any) {
        console.error('Error triggering cron:', error)
        return NextResponse.json({
            error: 'Internal Server Error',
            message: error.message
        }, { status: 500 })
    }
}
