import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/hours - Get all hours for review
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null

    const whereClause: {
      status?: string;
      user?: {
        id: string;
      };
    } = {}

    if (status) {
      whereClause.status = status
    }

    // ⚠️ NON filtriamo per weekStart perché dobbiamo calcolare la data EFFETTIVA del turno
    // (weekStart + dayOfWeek) e filtrare in base a quella!

    const workedHours = await prisma.worked_hours.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        shifts: {
          include: {
            schedules: true
          }
        }
      }
      // ❌ Non possiamo ordinare qui per data effettiva del turno (weekStart + dayOfWeek)
      // Lo faremo dopo aver recuperato i dati
    })

    // Map shifts -> shift and schedules -> schedule for frontend compatibility
    const mapped = workedHours.map((wh: any) => ({
      ...wh,
      shift: {
        ...wh.shifts,
        schedule: {
          weekStart: wh.shifts.schedules.weekStart
        }
      }
    }))

    // ✅ Filtra per mese/anno basandosi sulla DATA EFFETTIVA del turno
    let filtered = mapped
    if (month !== null && year !== null) {
      filtered = mapped.filter((wh: any) => {
        const weekStartDate = new Date(wh.shifts.schedules.weekStart)
        const shiftDate = new Date(Date.UTC(
          weekStartDate.getUTCFullYear(),
          weekStartDate.getUTCMonth(),
          weekStartDate.getUTCDate() + wh.shifts.dayOfWeek
        ))
        
        const shiftYear = shiftDate.getUTCFullYear()
        const shiftMonth = shiftDate.getUTCMonth() + 1 // getUTCMonth() returns 0-11
        
        return shiftYear === year && shiftMonth === month
      })
    }

    // ✅ Ordina per DATA EFFETTIVA DEL TURNO (chronological order)
    const sorted = filtered.sort((a: any, b: any) => {
      // Calcola la data effettiva del turno per A
      const weekStartA = new Date(a.shifts.schedules.weekStart)
      const shiftDateA = new Date(Date.UTC(
        weekStartA.getUTCFullYear(),
        weekStartA.getUTCMonth(),
        weekStartA.getUTCDate() + a.shifts.dayOfWeek
      ))
      
      // Calcola la data effettiva del turno per B
      const weekStartB = new Date(b.shifts.schedules.weekStart)
      const shiftDateB = new Date(Date.UTC(
        weekStartB.getUTCFullYear(),
        weekStartB.getUTCMonth(),
        weekStartB.getUTCDate() + b.shifts.dayOfWeek
      ))
      
      // Ordina cronologicamente (dal più vecchio al più recente)
      if (shiftDateA.getTime() !== shiftDateB.getTime()) {
        return shiftDateA.getTime() - shiftDateB.getTime()
      }
      
      // Se stessa data, ordina per tipo turno (PRANZO prima di CENA)
      if (a.shifts.shiftType !== b.shifts.shiftType) {
        return a.shifts.shiftType === 'PRANZO' ? -1 : 1
      }
      
      return 0
    })

    return NextResponse.json(sorted)
  } catch (error) {
    console.error('Error fetching hours for review:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
