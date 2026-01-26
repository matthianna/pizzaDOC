import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { scheduleBackup, listBackups, createDatabaseBackup } from '@/lib/database-backup'
import { format } from 'date-fns'

// GET - Lista tutti i backup disponibili o scarica backup
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === 'true'

    // Se richiesto download, crea e restituisci il backup
    if (download) {
      console.log(`[BACKUP] Download requested by ${session.user.username}`)
      
      const result = await createDatabaseBackup()
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Backup failed' },
          { status: 500 }
        )
      }

      // Log the action
      try {
        const { logAuditAction } = await import('@/lib/audit-logger')
        await logAuditAction({
          userId: session.user.id,
          userUsername: session.user.username,
          action: 'DATABASE_BACKUP',
          description: `Backup database scaricato: ${result.timestamp}`,
          metadata: {
            timestamp: result.timestamp,
            tables: result.tables
          }
        })
      } catch (e) {
        console.error('[BACKUP] Failed to log audit:', e)
      }

      const fileName = `pizzadoc_backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`
      const jsonString = JSON.stringify(result.data, null, 2)

      return new NextResponse(jsonString, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': Buffer.byteLength(jsonString).toString()
        }
      })
    }

    // Altrimenti lista i backup precedenti
    const backups = await listBackups()

    return NextResponse.json({
      backups,
      total: backups.length
    })
  } catch (error: any) {
    console.error('Error in backup route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Crea un nuovo backup (registra solo nel log, restituisce conferma)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`[BACKUP] Manual backup requested by ${session.user.username}`)

    const result = await scheduleBackup(session.user.id, session.user.username)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Backup failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Backup creato con successo',
      timestamp: result.timestamp,
      tables: result.tables,
      downloadUrl: '/api/admin/database/backup?download=true'
    })
  } catch (error: any) {
    console.error('Error creating backup:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Non più necessario ma manteniamo per compatibilità
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      message: 'I backup sono ora in-memory, nessun file da eliminare',
      deletedCount: 0
    })
  } catch (error: any) {
    console.error('Error in delete:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
