import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseBackup, cleanOldBackups } from '@/lib/database-backup'

/**
 * Endpoint Cron per backup giornalieri
 * 
 * Configurazione su Vercel:
 * 1. Vai su Project Settings > Cron Jobs
 * 2. Aggiungi path: /api/cron/daily-backup
 * 3. Schedule: 0 2 * * * (ogni giorno alle 2 AM)
 * 
 * Per sicurezza, usa un Authorization header secret
 */
export async function GET(request: NextRequest) {
  try {
    // Verifica authorization (opzionale ma consigliato)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Starting daily backup...')

    // Crea backup
    const backupResult = await createDatabaseBackup()

    if (!backupResult.success) {
      throw new Error(backupResult.error || 'Backup failed')
    }

    // Pulisci backup vecchi (mantieni ultimi 30 giorni)
    const cleanupResult = await cleanOldBackups(30)

    console.log(`[CRON] ✅ Daily backup completed`)
    console.log(`[CRON] 📁 Backup: ${backupResult.filePath}`)
    console.log(`[CRON] 🗑️  Deleted ${cleanupResult.deletedCount} old backups`)

    return NextResponse.json({
      success: true,
      backup: {
        path: backupResult.filePath,
        size: backupResult.size,
        sizeReadable: backupResult.size ? `${(backupResult.size / 1024 / 1024).toFixed(2)} MB` : 'unknown'
      },
      cleanup: {
        deletedCount: cleanupResult.deletedCount
      }
    })
  } catch (error: any) {
    console.error('[CRON] ❌ Daily backup failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    )
  }
}

