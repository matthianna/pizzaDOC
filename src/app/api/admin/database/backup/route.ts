import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { scheduleBackup, listBackups, cleanOldBackups } from '@/lib/database-backup'

// GET - Lista tutti i backup disponibili
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const backups = await listBackups()

    return NextResponse.json({
      backups,
      total: backups.length
    })
  } catch (error: any) {
    console.error('Error listing backups:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Crea un nuovo backup manuale
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
      filePath: result.filePath,
      size: result.size,
      sizeReadable: result.size ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : 'unknown'
    })
  } catch (error: any) {
    console.error('Error creating backup:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Elimina backup vecchi (mantieni solo ultimi 30 giorni)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const daysToKeep = parseInt(searchParams.get('days') || '30')

    const result = await cleanOldBackups(daysToKeep)

    return NextResponse.json({
      success: true,
      message: `Eliminati ${result.deletedCount} backup vecchi`,
      deletedCount: result.deletedCount
    })
  } catch (error: any) {
    console.error('Error cleaning backups:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

