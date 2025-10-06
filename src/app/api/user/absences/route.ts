import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek } from 'date-fns'
import { convertJsDayToOurDay } from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'

// GET /api/user/absences - Get user's absences
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const absences = await prisma.absence.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        startDate: 'desc'
      }
    })

    return NextResponse.json(absences)
  } catch (error) {
    console.error('Error fetching absences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/user/absences - Create new absence
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { startDate, endDate, reason, notes } = await request.json()

    // Validazione
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const start = normalizeDate(startDate)
    const end = normalizeDate(endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Non permettere assenze nel passato
    if (start < today) {
      return NextResponse.json(
        { error: 'Non puoi creare assenze nel passato' },
        { status: 400 }
      )
    }

    // End date deve essere >= start date
    if (end < start) {
      return NextResponse.json(
        { error: 'La data di fine deve essere successiva o uguale alla data di inizio' },
        { status: 400 }
      )
    }

    // Controlla sovrapposizioni con assenze esistenti
    const overlappingAbsences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        OR: [
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: start } }
            ]
          }
        ]
      }
    })

    if (overlappingAbsences.length > 0) {
      return NextResponse.json(
        { error: 'Esiste già un\'assenza in questo periodo' },
        { status: 400 }
      )
    }

    const absence = await prisma.absence.create({
      data: {
        userId: session.user.id,
        startDate: start,
        endDate: end,
        reason: reason || null,
        notes: notes || null
      }
    })

    // Aggiorna automaticamente le disponibilità per i giorni in assenza
    // Trova tutte le settimane che si sovrappongono con l'assenza
    const weekStarts: Date[] = []
    let currentWeek = startOfWeek(start, { weekStartsOn: 1 }) // 1 = Monday
    currentWeek.setHours(0, 0, 0, 0)
    
    while (currentWeek <= end) {
      weekStarts.push(new Date(currentWeek))
      currentWeek.setDate(currentWeek.getDate() + 7)
    }

    // Per ogni giorno nell'intervallo di assenza, disabilita disponibilità
    let dayToCheck = new Date(start)
    dayToCheck.setHours(0, 0, 0, 0)
    
    while (dayToCheck <= end) {
      // Trova il lunedì di questa settimana
      const mondayOfWeek = startOfWeek(dayToCheck, { weekStartsOn: 1 })
      mondayOfWeek.setHours(0, 0, 0, 0)
      
      // Converti da JS day (0=Sunday) al nostro sistema (0=Monday)
      const jsDay = dayToCheck.getDay()
      const ourDay = convertJsDayToOurDay(jsDay)
      
      // Aggiorna disponibilità per questo giorno (sia PRANZO che CENA)
      await prisma.availability.updateMany({
        where: {
          userId: session.user.id,
          weekStart: mondayOfWeek,
          dayOfWeek: ourDay, // 0=Monday, 1=Tuesday, ..., 6=Sunday
          isAvailable: true
        },
        data: {
          isAvailable: false
        }
      })
      
      // Vai al giorno successivo
      dayToCheck.setDate(dayToCheck.getDate() + 1)
    }

    return NextResponse.json(absence, { status: 201 })
  } catch (error) {
    console.error('Error creating absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

