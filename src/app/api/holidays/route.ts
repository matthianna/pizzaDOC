import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Ottieni tutti i giorni festivi per un range di date (per utenti normali)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let whereClause: any = {}

    if (startDate && endDate) {
      const start = new Date(startDate)
      start.setUTCHours(0, 0, 0, 0)
      
      const end = new Date(endDate)
      end.setUTCHours(23, 59, 59, 999)
      
      whereClause.date = {
        gte: start,
        lte: end
      }
    }

    const holidays = await prisma.holidays.findMany({
      where: whereClause,
      orderBy: {
        date: 'asc'
      },
      select: {
        id: true,
        date: true,
        closureType: true,
        description: true
      }
    })

    return NextResponse.json(holidays)
  } catch (error) {
    console.error('Error fetching holidays:', error)
    return NextResponse.json({ error: 'Errore nel recupero dei giorni festivi' }, { status: 500 })
  }
}

