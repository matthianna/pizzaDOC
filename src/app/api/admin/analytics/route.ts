import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek, differenceInHours, differenceInDays } from 'date-fns'
import { normalizeDate } from '@/lib/normalize-date'

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'weekStart parameter is required' }, { status: 400 })
    }

    // Normalizza la data eliminando l'orario per evitare problemi di timezone
    const weekStart = normalizeDate(weekStartParam)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    // 1. Carica turni della settimana
    const shifts = await prisma.shift.findMany({
      where: {
        schedule: {
          weekStart: weekStart
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        },
        workedHours: true,
        schedule: true
      }
    })

    // 2. Carica limiti turni
    const shiftLimits = await prisma.shiftLimits.findMany()

    // 3. Carica sostituzioni
    const substitutions = await prisma.substitution.findMany({
      where: {
        shift: {
          schedule: {
            weekStart: weekStart
          }
        }
      },
      include: {
        shift: {
          include: {
            schedule: true
          }
        }
      }
    })

    // 4. Carica assenze (della settimana e storiche per alcune statistiche)
    const absences = await prisma.absence.findMany({
      where: {
        OR: [
          {
            AND: [
              { startDate: { lte: weekEnd } },
              { endDate: { gte: weekStart } }
            ]
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    // Calcola statistiche

    // Statistiche generali
    const totalShifts = shifts.length
    const uniqueWorkers = new Set(shifts.map(s => s.userId))
    const totalWorkers = uniqueWorkers.size

    // Calcola ore totali lavorate (solo approvate)
    let totalHoursWorked = 0
    shifts.forEach(shift => {
      if (shift.workedHours) {
        const approvedHours = Array.isArray(shift.workedHours) 
          ? shift.workedHours.find(wh => wh.status === 'APPROVED')
          : (shift.workedHours.status === 'APPROVED' ? shift.workedHours : null)
        if (approvedHours && approvedHours.totalHours) {
          totalHoursWorked += approvedHours.totalHours
        }
      }
    })

    const avgShiftsPerWorker = totalWorkers > 0 ? totalShifts / totalWorkers : 0

    // Statistiche ore per utente
    const userHoursMap = new Map<string, {
      username: string
      totalHours: number
      totalShifts: number
      pendingHours: number
      approvedHours: number
      rejectedHours: number
    }>()

    shifts.forEach(shift => {
      if (!userHoursMap.has(shift.userId)) {
        userHoursMap.set(shift.userId, {
          username: shift.user.username,
          totalHours: 0,
          totalShifts: 0,
          pendingHours: 0,
          approvedHours: 0,
          rejectedHours: 0
        })
      }

      const userStats = userHoursMap.get(shift.userId)!
      userStats.totalShifts++

      if (shift.workedHours) {
        const workedHoursArray = Array.isArray(shift.workedHours) ? shift.workedHours : [shift.workedHours]
        workedHoursArray.forEach(wh => {
          if (wh && wh.totalHours) {
            userStats.totalHours += wh.totalHours
            if (wh.status === 'PENDING') userStats.pendingHours += wh.totalHours
            if (wh.status === 'APPROVED') userStats.approvedHours += wh.totalHours
            if (wh.status === 'REJECTED') userStats.rejectedHours += wh.totalHours
          }
        })
      }
    })

    const userHoursStats = Array.from(userHoursMap.values())
      .map(user => ({
        ...user,
        avgHoursPerShift: user.totalShifts > 0 ? user.totalHours / user.totalShifts : 0
      }))
      .sort((a, b) => b.totalHours - a.totalHours)

    // Distribuzione per ruolo
    const roleMap = new Map<string, { totalShifts: number; totalHours: number }>()
    shifts.forEach(shift => {
      if (!roleMap.has(shift.role)) {
        roleMap.set(shift.role, { totalShifts: 0, totalHours: 0 })
      }
      const roleStats = roleMap.get(shift.role)!
      roleStats.totalShifts++
      
      if (shift.workedHours) {
        const approvedHours = Array.isArray(shift.workedHours)
          ? shift.workedHours.find(wh => wh.status === 'APPROVED')
          : (shift.workedHours.status === 'APPROVED' ? shift.workedHours : null)
        if (approvedHours && approvedHours.totalHours) {
          roleStats.totalHours += approvedHours.totalHours
        }
      }
    })

    const roleDistribution = Array.from(roleMap.entries()).map(([role, stats]) => ({
      role,
      totalShifts: stats.totalShifts,
      totalHours: stats.totalHours,
      percentage: totalShifts > 0 ? (stats.totalShifts / totalShifts) * 100 : 0
    }))

    // Distribuzione per giorno
    const dayMap = new Map<number, { totalShifts: number; workers: Set<string> }>()
    for (let i = 0; i < 7; i++) {
      dayMap.set(i, { totalShifts: 0, workers: new Set() })
    }

    shifts.forEach(shift => {
      const dayStats = dayMap.get(shift.dayOfWeek)!
      dayStats.totalShifts++
      dayStats.workers.add(shift.userId)
    })

    const dayDistribution = Array.from(dayMap.entries())
      .map(([dayOfWeek, stats]) => ({
        day: DAY_NAMES[dayOfWeek],
        dayOfWeek,
        totalShifts: stats.totalShifts,
        totalWorkers: stats.workers.size,
        avgWorkersPerShift: stats.totalShifts > 0 ? stats.workers.size / (stats.totalShifts / 2) : 0 // Assume 2 shift types
      }))

    // Distribuzione per tipo turno
    const shiftTypeMap = new Map<string, number>()
    shifts.forEach(shift => {
      shiftTypeMap.set(shift.shiftType, (shiftTypeMap.get(shift.shiftType) || 0) + 1)
    })

    const shiftTypeDistribution = Array.from(shiftTypeMap.entries()).map(([shiftType, count]) => ({
      shiftType,
      totalShifts: count,
      percentage: totalShifts > 0 ? (count / totalShifts) * 100 : 0
    }))

    // Statistiche sostituzioni
    const substitutionStats = {
      totalRequests: substitutions.length,
      pending: substitutions.filter(s => s.status === 'PENDING').length,
      approved: substitutions.filter(s => s.status === 'APPROVED').length,
      rejected: substitutions.filter(s => s.status === 'REJECTED').length,
      avgResponseTime: 0
    }

    // Calcola tempo medio di risposta per sostituzioni approvate/rifiutate
    const respondedSubstitutions = substitutions.filter(s => 
      (s.status === 'APPROVED' || s.status === 'REJECTED') && s.updatedAt
    )
    if (respondedSubstitutions.length > 0) {
      const totalResponseHours = respondedSubstitutions.reduce((sum, sub) => {
        return sum + differenceInHours(sub.updatedAt, sub.createdAt)
      }, 0)
      substitutionStats.avgResponseTime = totalResponseHours / respondedSubstitutions.length
    }

    // Copertura turni
    let totalRequiredSlots = 0
    const requiredMap = new Map<string, number>()
    
    shiftLimits.forEach(limit => {
      const key = `${limit.dayOfWeek}_${limit.shiftType}_${limit.role}`
      requiredMap.set(key, limit.minStaff)
      totalRequiredSlots += limit.minStaff
    })

    const assignedMap = new Map<string, number>()
    shifts.forEach(shift => {
      const key = `${shift.dayOfWeek}_${shift.shiftType}_${shift.role}`
      assignedMap.set(key, (assignedMap.get(key) || 0) + 1)
    })

    const gaps: { day: string; shiftType: string; role: string; missing: number }[] = []
    shiftLimits.forEach(limit => {
      const key = `${limit.dayOfWeek}_${limit.shiftType}_${limit.role}`
      const assigned = assignedMap.get(key) || 0
      const missing = limit.minStaff - assigned
      if (missing > 0) {
        gaps.push({
          day: DAY_NAMES[limit.dayOfWeek],
          shiftType: limit.shiftType,
          role: limit.role,
          missing
        })
      }
    })

    const totalFilledSlots = shifts.length
    const coveragePercentage = totalRequiredSlots > 0 ? (totalFilledSlots / totalRequiredSlots) * 100 : 0

    const coverageStats = {
      totalRequiredSlots,
      totalFilledSlots,
      coveragePercentage,
      gaps
    }

    // Trasporti
    const transportStats = {
      scooter: 0,
      auto: 0,
      bicicletta: 0,
      piedi: 0
    }

    // Conta trasporti dai turni FATTORINO
    const fattorinoShifts = shifts.filter(s => s.role === 'FATTORINO')
    for (const shift of fattorinoShifts) {
      const user = await prisma.user.findUnique({
        where: { id: shift.userId },
        select: { primaryTransport: true }
      })
      if (user?.primaryTransport) {
        const transport = user.primaryTransport.toLowerCase()
        if (transport in transportStats) {
          transportStats[transport as keyof typeof transportStats]++
        }
      }
    }

    // Top performers
    const performersData = Array.from(userHoursMap.values())
      .map(user => {
        const userShifts = shifts.filter(s => s.user.username === user.username)
        const totalShiftsForUser = userShifts.length
        const shiftsWithApprovedHours = userShifts.filter(s => {
          if (!s.workedHours) return false
          const workedHoursArray = Array.isArray(s.workedHours) ? s.workedHours : [s.workedHours]
          return workedHoursArray.some(wh => wh && wh.status === 'APPROVED')
        }).length
        
        const reliability = totalShiftsForUser > 0 
          ? (shiftsWithApprovedHours / totalShiftsForUser) * 100 
          : 0

        return {
          username: user.username,
          totalShifts: user.totalShifts,
          totalHours: user.totalHours,
          reliability
        }
      })
      .sort((a, b) => {
        // Ordina per affidabilità poi per ore totali
        if (b.reliability !== a.reliability) return b.reliability - a.reliability
        return b.totalHours - a.totalHours
      })
      .slice(0, 3)

    // Statistiche assenze
    const activeAbsences = absences.filter(abs => {
      const now = new Date()
      return abs.startDate <= now && abs.endDate >= now
    })

    const totalAbsenceDays = absences.reduce((sum, abs) => {
      return sum + differenceInDays(abs.endDate, abs.startDate) + 1
    }, 0)

    const avgAbsenceDuration = absences.length > 0 ? totalAbsenceDays / absences.length : 0

    // Raggruppa assenze per utente
    const userAbsenceMap = new Map<string, { totalDays: number; absenceCount: number }>()
    absences.forEach(abs => {
      const days = differenceInDays(abs.endDate, abs.startDate) + 1
      if (!userAbsenceMap.has(abs.user.username)) {
        userAbsenceMap.set(abs.user.username, { totalDays: 0, absenceCount: 0 })
      }
      const userAbsStats = userAbsenceMap.get(abs.user.username)!
      userAbsStats.totalDays += days
      userAbsStats.absenceCount++
    })

    const topAbsences = Array.from(userAbsenceMap.entries())
      .map(([username, stats]) => ({
        username,
        ...stats
      }))
      .sort((a, b) => b.totalDays - a.totalDays)
      .slice(0, 5)

    const absenceStats = {
      totalAbsences: absences.length,
      activeAbsences: activeAbsences.length,
      avgAbsenceDuration,
      topAbsences
    }

    // Assembla risposta completa
    const analytics = {
      totalShifts,
      totalWorkers,
      totalHoursWorked,
      avgShiftsPerWorker,
      userHoursStats,
      roleDistribution,
      dayDistribution,
      shiftTypeDistribution,
      substitutionStats,
      coverageStats,
      transportStats,
      topPerformers: performersData,
      absenceStats
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

