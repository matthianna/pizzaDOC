import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

// ⚠️ IMPORTANTE: Disabilita cache per avere sempre dati aggiornati
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ottieni weekStart dalla query string
    const { searchParams } = new URL(req.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'weekStart parameter is required' }, { status: 400 })
    }
    
    // ⭐ USA normalizeDate per UTC consistency (come tutti gli altri endpoint!)
    const weekStart = normalizeDate(weekStartParam)
    
    // Calculate weekEnd (Sunday UTC midnight)
    const weekEnd = new Date(Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + 6,
      23, 59, 59, 999
    ))
    
    console.log(`🔍 [API /api/admin/users/available] Richiesta per settimana: ${weekStart.toISOString()}`)

    // Fetch all active users with their roles and availabilities FOR THIS SPECIFIC WEEK (excluding admins for scheduling)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        user_roles: {
          some: {
            role: {
              in: ['FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO'] // Exclude ADMIN from scheduling
            }
          }
        }
      },
      include: {
        user_roles: {
          where: {
            role: {
              in: ['FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO']
            }
          }
        },
        availabilities: {
          where: {
            weekStart: weekStart // ⭐ FILTRA PER SETTIMANA SPECIFICA!
          },
          select: {
            dayOfWeek: true,
            shiftType: true,
            isAvailable: true
          }
        },
        absences: {
          where: {
            OR: [
              {
                AND: [
                  { startDate: { lte: weekStart } },
                  { endDate: { gte: weekEnd } }
                ]
              },
              {
                AND: [
                  { startDate: { gte: weekStart } },
                  { endDate: { lte: weekEnd } }
                ]
              },
              {
                AND: [
                  { startDate: { lte: weekStart } },
                  { endDate: { gte: weekStart, lte: weekEnd } }
                ]
              },
              {
                AND: [
                  { startDate: { gte: weekStart, lte: weekEnd } },
                  { endDate: { gte: weekEnd } }
                ]
              }
            ]
          },
          select: {
            id: true,
            startDate: true,
            endDate: true
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    })

    console.log(`✅ [API] Utenti trovati (prima del filtro assenze): ${users.length}`)
    
    // Filter out users who are absent for the ENTIRE week
    const filteredUsers = users.filter((user: any) => {
      // Se non ha assenze, include l'utente
      if (user.absences.length === 0) return true

      // Calcola quanti giorni della settimana sono coperti da assenze
      const weekStartTime = weekStart.getTime()
      const weekEndTime = weekEnd.getTime()
      const oneDayMs = 24 * 60 * 60 * 1000

      // Create set of all days in the week (7 days)
      const weekDays = new Set<string>()
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStartTime + i * oneDayMs)
        weekDays.add(dayDate.toISOString().split('T')[0])
      }

      // Mark days covered by absences
      const coveredDays = new Set<string>()
      for (const absence of user.absences) {
        const absenceStart = Math.max(absence.startDate.getTime(), weekStartTime)
        const absenceEnd = Math.min(absence.endDate.getTime(), weekEndTime)
        
        let currentDay = absenceStart
        while (currentDay <= absenceEnd) {
          const dayStr = new Date(currentDay).toISOString().split('T')[0]
          coveredDays.add(dayStr)
          currentDay += oneDayMs
        }
      }

      // Se tutti i 7 giorni sono coperti da assenze, escludi l'utente
      const allDaysCovered = weekDays.size === coveredDays.size && 
                            Array.from(weekDays).every(day => coveredDays.has(day))
      
      if (allDaysCovered) {
        console.log(`🚫 [API] Escludo ${user.username} - assente per tutta la settimana`)
      }
      
      return !allDaysCovered // Include solo se NON completamente assente
    })
    
    console.log(`✅ [API] Utenti disponibili (dopo filtro assenze): ${filteredUsers.length}`)
    
    // Transform to simpler format
    const availableUsers = filteredUsers.map((user: any) => ({
      id: user.id,
      username: user.username,
      primaryRole: user.primaryRole,
      availableRoles: user.user_roles.map((ur: any) => ur.role),
      availabilities: user.availabilities
    }))
    
    // Log dettagliato disponibilità
    const totalAvailabilities = availableUsers.reduce((sum: number, u: any) => sum + u.availabilities.length, 0)
    const usersWithAvailabilities = availableUsers.filter((u: any) => u.availabilities.length > 0).length
    console.log(`✅ [API] Disponibilità trovate: ${totalAvailabilities} totali`)
    console.log(`✅ [API] Utenti con disponibilità: ${usersWithAvailabilities}/${filteredUsers.length}`)
    
    if (usersWithAvailabilities === 0) {
      console.warn(`⚠️  [API] NESSUN utente ha disponibilità per ${weekStart.toISOString().split('T')[0]}!`)
    }

    // ⚠️ Headers anti-cache per garantire dati sempre freschi
    return NextResponse.json(availableUsers, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching available users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
