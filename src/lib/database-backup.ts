import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { format } from 'date-fns'

const execAsync = promisify(exec)

interface BackupResult {
  success: boolean
  filePath?: string
  size?: number
  error?: string
}

/**
 * Crea un backup completo del database PostgreSQL
 */
export async function createDatabaseBackup(): Promise<BackupResult> {
  try {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured')
    }

    // Parse connection string
    const url = new URL(databaseUrl)
    const dbName = url.pathname.slice(1)
    const host = url.hostname
    const port = url.port || '5432'
    const username = url.username
    const password = url.password

    // Crea directory backups se non esiste
    const backupDir = join(process.cwd(), 'backups')
    await mkdir(backupDir, { recursive: true })

    // Nome file con timestamp
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss')
    const fileName = `neon_backup_${timestamp}.sql`
    const filePath = join(backupDir, fileName)

    // Comando pg_dump
    const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${dbName} -F p -f ${filePath}`

    // Esegui backup
    await execAsync(command, {
      env: {
        ...process.env,
        PGPASSWORD: password
      },
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    })

    // Verifica che il file sia stato creato
    const fs = await import('fs/promises')
    const stats = await fs.stat(filePath)

    console.log(`[BACKUP] ✅ Database backup created: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)

    return {
      success: true,
      filePath,
      size: stats.size
    }
  } catch (error: any) {
    console.error('[BACKUP] ❌ Failed to create backup:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Esegue un backup e registra nel log di audit
 */
export async function scheduleBackup(userId?: string, username?: string) {
  const result = await createDatabaseBackup()
  
  if (result.success && userId && username) {
    // Log nel sistema di audit
    const { logAuditAction } = await import('./audit-logger')
    await logAuditAction({
      userId,
      userUsername: username,
      action: 'DATABASE_BACKUP',
      description: `Backup database creato: ${result.filePath}`,
      metadata: {
        filePath: result.filePath,
        size: result.size,
        sizeReadable: result.size ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : 'unknown'
      }
    })
  }

  return result
}

/**
 * Ottieni la lista dei backup disponibili
 */
export async function listBackups() {
  try {
    const backupDir = join(process.cwd(), 'backups')
    const fs = await import('fs/promises')
    
    try {
      const files = await fs.readdir(backupDir)
      const backupFiles = files.filter(f => f.startsWith('neon_backup_') && f.endsWith('.sql'))
      
      const backups = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = join(backupDir, file)
          const stats = await fs.stat(filePath)
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            sizeReadable: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
            createdAt: stats.birthtime
          }
        })
      )

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } catch (error) {
      // Directory doesn't exist
      return []
    }
  } catch (error) {
    console.error('[BACKUP] Error listing backups:', error)
    return []
  }
}

/**
 * Elimina i backup più vecchi di X giorni
 */
export async function cleanOldBackups(daysToKeep: number = 30) {
  try {
    const backups = await listBackups()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const fs = await import('fs/promises')
    let deletedCount = 0

    for (const backup of backups) {
      if (backup.createdAt < cutoffDate) {
        await fs.unlink(backup.path)
        deletedCount++
        console.log(`[BACKUP] 🗑️  Deleted old backup: ${backup.filename}`)
      }
    }

    return { deletedCount }
  } catch (error) {
    console.error('[BACKUP] Error cleaning old backups:', error)
    return { deletedCount: 0 }
  }
}

