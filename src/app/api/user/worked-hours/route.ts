import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

const DAY_MS = 86400000

// GET - Fetch worked hours for a user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json(
        { error: 'Parametro settimana mancante' },
        { status: 400 }
      )
    }

    const weekStart = normalizeDate(weekStartParam)
    const candidateTimes = [
      weekStart.getTime() - DAY_MS,
      weekStart.getTime(),
      weekStart.getTime() + DAY_MS,
    ]
    const weekStartCandidates = [
      ...new Set(candidateTimes.map((t) => normalizeDate(new Date(t)).getTime())),
    ].map((t) => new Date(t))

    const workedHours = await prisma.worked_hours.findMany({
      where: {
        userId: session.user.id,
        shifts: {
          schedules: {
            weekStart: { in: weekStartCandidates },
          },
        },
      },
      include: {
        shifts: {
          include: {
            schedules: true
          }
        }
      }
      // Note: Cannot use nested orderBy with Prisma, will sort in JavaScript below
    })

    // Sort in JavaScript since Prisma doesn't support nested orderBy
    const sortedHours = workedHours.sort((a: any, b: any) => {
      if (a.shifts.dayOfWeek !== b.shifts.dayOfWeek) {
        return a.shifts.dayOfWeek - b.shifts.dayOfWeek
      }
      // If same day, sort by shift type (PRANZO before CENA)
      return a.shifts.shiftType === 'PRANZO' ? -1 : 1
    })

    return NextResponse.json(sortedHours)
  } catch (error) {
    console.error('Error fetching worked hours:', error)
    return NextResponse.json(
      { error: 'Errore del server. Riprova più tardi.' },
      { status: 500 }
    )
  }
}

// POST — disabilitato: solo gli admin registrano le ore (vedi POST /api/admin/hours)
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Le ore possono essere inserite solo dall’amministrazione. Contatta un amministratore se serve una correzione.',
    },
    { status: 403 }
  )
}
