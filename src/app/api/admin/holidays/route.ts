import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { logAuditAction } from '@/lib/audit-logger'

// GET - Ottieni tutti i giorni festivi (con filtro opzionale per mese/anno)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month') // formato: YYYY-MM
    const year = searchParams.get('year')   // formato: YYYY

    let whereClause: any = {}

    if (month) {
      // Filtra per mese specifico (es: 2024-12)
      const [yearNum, monthNum] = month.split('-').map(Number)
      const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1))
      const endDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59))
      
      whereClause.date = {
        gte: startDate,
        lte: endDate
      }
    } else if (year) {
      // Filtra per anno (es: 2024)
      const yearNum = parseInt(year)
      const startDate = new Date(Date.UTC(yearNum, 0, 1))
      const endDate = new Date(Date.UTC(yearNum, 11, 31, 23, 59, 59))
      
      whereClause.date = {
        gte: startDate,
        lte: endDate
      }
    }

    const holidays = await prisma.holidays.findMany({
      where: whereClause,
      orderBy: {
        date: 'asc'
      }
    })

    return NextResponse.json(holidays)
  } catch (error) {
    console.error('Error fetching holidays:', error)
    return NextResponse.json({ error: 'Errore nel recupero dei giorni festivi' }, { status: 500 })
  }
}

// POST - Crea un nuovo giorno festivo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.user.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const { date, closureType, description } = await request.json()

    // Validazione
    if (!date || !closureType) {
      return NextResponse.json(
        { error: 'Data e tipo di chiusura sono obbligatori' },
        { status: 400 }
      )
    }

    if (!['FULL_DAY', 'PRANZO_ONLY', 'CENA_ONLY'].includes(closureType)) {
      return NextResponse.json(
        { error: 'Tipo di chiusura non valido' },
        { status: 400 }
      )
    }

    // Normalizza la data a UTC midnight
    const holidayDate = new Date(date)
    holidayDate.setUTCHours(0, 0, 0, 0)

    // Verifica se esiste già un giorno festivo per quella data e tipo
    const existing = await prisma.holidays.findFirst({
      where: {
        date: holidayDate,
        closureType: closureType
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Esiste già un giorno festivo per questa data e tipo di chiusura' },
        { status: 409 }
      )
    }

    const holiday = await prisma.holidays.create({
      data: {
        id: uuidv4(),
        date: holidayDate,
        closureType,
        description: description || null,
        createdBy: session.user.id,
        updatedAt: new Date()
      }
    })

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'HOLIDAY_CREATE',
      description: `Creato giorno festivo: ${holidayDate.toISOString().split('T')[0]} (${closureType})`,
      metadata: { holidayId: holiday.id, date: holidayDate, closureType, description }
    })

    return NextResponse.json(holiday, { status: 201 })
  } catch (error) {
    console.error('Error creating holiday:', error)
    return NextResponse.json({ error: 'Errore nella creazione del giorno festivo' }, { status: 500 })
  }
}

