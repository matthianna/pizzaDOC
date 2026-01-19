import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { normalizeDate } from '@/lib/normalize-date'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const rawWeekStart = normalizeDate(resolvedParams.weekStart)

    // Query con la data dal database
    const schedule = await prisma.schedules.findUnique({
      where: { weekStart: rawWeekStart },
      include: {
        shifts: {
          include: {
            user: {
              select: {
                username: true,
                primaryRole: true
              }
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { shiftType: 'asc' },
            { role: 'asc' },
            { startTime: 'asc' }
          ]
        }
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Carica i giorni festivi per la settimana
    const weekEnd = addDays(rawWeekStart, 6)
    const holidays = await prisma.holidays.findMany({
      where: {
        date: {
          gte: rawWeekStart,
          lte: weekEnd
        }
      }
    })

    // weekStart dal DB è già normalizzato a lunedì UTC
    const weekStart = normalizeDate(schedule.weekStart)

    // Genera l'HTML per il PDF
    const html = generateScheduleHTML(schedule, weekStart, holidays)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  } catch (error) {
    console.error('Error generating PDF data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateScheduleHTML(schedule: {
  shifts: Array<{
    id: string;
    dayOfWeek: number;
    shiftType: string;
    role: string;
    startTime: string;
    user: {
      username: string;
      primaryRole: string | null;
    };
  }>;
  weekStart: Date;
}, weekStart: Date, holidays: Array<{
  id: string;
  date: Date;
  closureType: string;
  description: string | null;
}>): string {

  const weekEnd = addDays(weekStart, 6)
  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

  // Raggruppa turni per giorno e tipo (0=Lunedì, 6=Domenica)
  const shiftsByDayAndType: Record<number, Record<string, Array<{
    role: string;
    startTime: string;
    user: {
      username: string;
      primaryRole: string | null;
    };
  }>>> = {}

  // Inizializza tutti i giorni
  for (let day = 0; day <= 6; day++) {
    shiftsByDayAndType[day] = {
      'PRANZO': [],
      'CENA': []
    }
  }

  // Raggruppa i turni E ORDINA PER ORARIO
  schedule.shifts.forEach(shift => {
    if (shift.user) {
      shiftsByDayAndType[shift.dayOfWeek][shift.shiftType].push(shift)
    }
  })

  // ORDINA ogni gruppo per startTime (ordine cronologico)
  for (let day = 0; day <= 6; day++) {
    ['PRANZO', 'CENA'].forEach(shiftType => {
      shiftsByDayAndType[day][shiftType].sort((a, b) => {
        return a.startTime.localeCompare(b.startTime)
      })
    })
  }

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Piano di Lavoro - ${format(weekStart, 'dd/MM/yyyy', { locale: it })}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm;
        }
        
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
        
        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
        }
        
        body { 
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 9px;
            line-height: 1.2;
            color: #1e293b;
            background: white;
        }
        
        .container {
            width: 100%;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding: 10px 15px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
        }

        .header-text h1 {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -0.5px;
            text-transform: uppercase;
        }

        .header-text p {
            font-size: 9px;
            color: #ea580c;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            margin-bottom: 1px;
        }
        
        .week-dates {
            font-size: 13px;
            font-weight: 900;
            color: #334155;
            background: white;
            padding: 5px 12px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }

        .schedule-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #cbd5e1;
            table-layout: fixed;
        }
        
        .schedule-table th {
            background: #334155;
            color: white;
            padding: 8px 10px;
            text-align: left;
            font-weight: 800;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 1px solid #1e293b;
        }
        
        .schedule-table th:first-child { width: 75px; }
        
        .day-row td {
            vertical-align: top;
            border: 1px solid #cbd5e1;
        }

        .day-cell {
            background: #f1f5f9;
            padding: 6px 4px;
            text-align: center;
        }
        
        .day-name {
            font-size: 10px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 1px;
        }
        
        .day-date {
            font-size: 8px;
            color: #ea580c;
            font-weight: 800;
        }
        
        .shift-cell {
            padding: 4px !important;
            background: white;
        }
        
        .workers-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 3px;
        }
        
        .worker-item {
            padding: 3px 5px;
            background: #ffffff;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border: 1px solid #e2e8f0;
            min-height: 26px;
        }
        
        .worker-name {
            font-weight: 800;
            color: #0f172a;
            font-size: 8.5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 65%;
        }
        
        .worker-time {
            font-weight: 900;
            color: #ea580c;
            font-size: 7.5px;
            margin-left: 2px;
            background: #fff7ed;
            padding: 1px 2px;
            border-radius: 2px;
            border: 1px solid #ffedd5;
        }

        /* Role Indicators */
        .pizzaiolo { border-left: 4px solid #ef4444; background: #fff1f2; }
        .cucina { border-left: 4px solid #f97316; background: #fff7ed; }
        .fattorino { border-left: 4px solid #3b82f6; background: #f0f9ff; }
        .sala { border-left: 4px solid #22c55e; background: #f0fdf4; }
        
        .closed-cell {
            background: #fef2f2;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px;
            border-radius: 6px;
            border: 1px dashed #fecaca;
            height: 100%;
        }

        .closed-text {
            color: #dc2626;
            font-weight: 900;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .empty-shift {
            color: #94a3b8;
            padding: 10px;
            text-align: center;
            font-size: 9px;
            font-style: italic;
        }

        .legend {
            margin-top: 12px;
            display: flex;
            gap: 15px;
            justify-content: center;
            padding: 8px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            color: #475569;
        }

        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-text">
                <p>PizzaDOC Operativo</p>
                <h1>Piano Turni Settimanale</h1>
            </div>
            <div class="week-dates">
                ${format(weekStart, 'd', { locale: it })} - ${format(weekEnd, 'd MMM yyyy', { locale: it })}
            </div>
        </div>

        <table class="schedule-table">
            <thead>
                <tr>
                    <th>Giorno</th>
                    <th>Turno Pranzo</th>
                    <th>Turno Cena</th>
                </tr>
            </thead>
            <tbody>
                ${days.map((dayName, dayIndex) => {
    const dayDate = addDays(weekStart, dayIndex)
    const pranzoShifts = shiftsByDayAndType[dayIndex]['PRANZO'] || []
    const cenaShifts = shiftsByDayAndType[dayIndex]['CENA'] || []

    const dayDateStr = dayDate.toISOString().split('T')[0]
    const isPranzoHoliday = holidays.some(h => {
      const holidayDateStr = new Date(h.date).toISOString().split('T')[0]
      return holidayDateStr === dayDateStr && (h.closureType === 'FULL_DAY' || h.closureType === 'PRANZO_ONLY')
    })
    const isCenaHoliday = holidays.some(h => {
      const holidayDateStr = new Date(h.date).toISOString().split('T')[0]
      return holidayDateStr === dayDateStr && (h.closureType === 'FULL_DAY' || h.closureType === 'CENA_ONLY')
    })

    return `
                <tr class="day-row">
                    <td class="day-cell">
                        <div class="day-name">${dayName}</div>
                        <div class="day-date">${format(dayDate, 'dd/MM')}</div>
                    </td>
                    <td class="shift-cell">
                        ${isPranzoHoliday ? `
                        <div class="closed-cell">
                            <span class="closed-text">🔒 CHIUSO</span>
                        </div>
                        ` : pranzoShifts.length > 0 ? `
                        <div class="workers-grid">
                            ${pranzoShifts.map(shift => `
                            <div class="worker-item ${shift.role.toLowerCase()}">
                                <span class="worker-name">${shift.user.username}</span>
                                <span class="worker-time">${shift.startTime}</span>
                            </div>
                            `).join('')}
                        </div>
                        ` : `
                        <div class="empty-shift">- Nessuno -</div>
                        `}
                    </td>
                    <td class="shift-cell">
                        ${isCenaHoliday ? `
                        <div class="closed-cell">
                            <span class="closed-text">🔒 CHIUSO</span>
                        </div>
                        ` : cenaShifts.length > 0 ? `
                        <div class="workers-grid">
                            ${cenaShifts.map(shift => `
                            <div class="worker-item ${shift.role.toLowerCase()}">
                                <span class="worker-name">${shift.user.username}</span>
                                <span class="worker-time">${shift.startTime}</span>
                            </div>
                            `).join('')}
                        </div>
                        ` : `
                        <div class="empty-shift">- Nessuno -</div>
                        `}
                    </td>
                </tr>
                  `
  }).join('')}
            </tbody>
        </table>

        <div class="legend">
            <div class="legend-item"><div class="legend-color" style="background: #ef4444"></div> Pizzaiolo</div>
            <div class="legend-item"><div class="legend-color" style="background: #f97316"></div> Cucina</div>
            <div class="legend-item"><div class="legend-color" style="background: #3b82f6"></div> Fattorino</div>
            <div class="legend-item"><div class="legend-color" style="background: #22c55e"></div> Sala</div>
        </div>
    </div>
</body>
</html>
  `
}
