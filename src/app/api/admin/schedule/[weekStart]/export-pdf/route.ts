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

  // Calcola statistiche
  const totalWorkers = schedule.shifts.filter(s => s.user).length
  const uniqueWorkers = new Set(schedule.shifts.filter(s => s.user).map(s => s.user.username)).size

  // Gruppo per ruolo per statistiche
  const roleCount: Record<string, number> = {}
  schedule.shifts.forEach(shift => {
    if (shift.user) {
      roleCount[shift.role] = (roleCount[shift.role] || 0) + 1
    }
  })

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Piano di Lavoro - ${format(weekStart, 'dd/MM/yyyy', { locale: it })}</title>
    <style>
        @page {
            size: A4;
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
            font-family: 'Inter', 'Segoe UI', 'Helvetica', sans-serif;
            font-size: 9px;
            line-height: 1.2;
            color: #1a1a1a;
            background: white;
            padding: 10px;
        }
        
        .container {
            width: 100%;
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f3f4f6;
        }

        .header-logo {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-box {
            width: 35px;
            height: 35px;
            background: #ea580c;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            font-weight: 900;
            box-shadow: 0 4px 6px -1px rgba(234, 88, 12, 0.2);
        }

        .header-text h1 {
            font-size: 16px;
            font-weight: 900;
            color: #111827;
            letter-spacing: -0.5px;
        }

        .header-text p {
            font-size: 10px;
            color: #6b7280;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Role Colors & Tints */
        .worker-item.pizzaiolo { 
            border-left: 4px solid #dc2626; 
            background: #fef2f2;
        }
        .worker-item.pizzaiolo .worker-role { color: #b91c1c; }
        
        .worker-item.cucina { 
            border-left: 4px solid #ea580c; 
            background: #fff7ed;
        }
        .worker-item.cucina .worker-role { color: #c2410c; }
        
        .worker-item.fattorino { 
            border-left: 4px solid #0284c7; 
            background: #f0f9ff;
        }
        .worker-item.fattorino .worker-role { color: #0369a1; }
        
        .worker-item.sala { 
            border-left: 4px solid #16a34a; 
            background: #f0fdf4;
        }
        .worker-item.sala .worker-role { color: #15803d; }
            width: 100%;
            border-collapse: separate;
            border-spacing: 0 4px;
            margin-bottom: 10px;
        }
        
        .schedule-table th {
            background: #f9fafb;
            color: #4b5563;
            padding: 8px;
            text-align: left;
            font-weight: 800;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .schedule-table th:first-child {
            width: 120px;
            border-radius: 8px 0 0 0;
        }
        
        .day-row td {
            padding: 0;
            vertical-align: top;
            border-top: 1px solid #f3f4f6;
            border-bottom: 1px solid #f3f4f6;
        }

        .day-cell {
            background: #f9fafb;
            padding: 8px !important;
            border-left: 1px solid #f3f4f6;
            width: 120px;
        }
        
        .day-name {
            font-size: 11px;
            font-weight: 900;
            color: #111827;
            text-transform: capitalize;
        }
        
        .day-date {
            font-size: 8px;
            color: #ea580c;
            font-weight: 700;
        }
        
        .shift-cell {
            padding: 6px !important;
            background: white;
            border-right: 1px solid #f3f4f6;
            width: 400px;
        }
        
        .workers-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 4px;
        }
        
        .worker-item {
            padding: 5px 8px;
            background: #ffffff;
            border-radius: 6px;
            border: 1px solid #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        
        .worker-info {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }

        .worker-name {
            font-weight: 800;
            color: #111827;
            font-size: 10px;
        }
        
        .worker-role {
            font-size: 7px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        
        .worker-time {
            background: #f3f4f6;
            padding: 2px 5px;
            border-radius: 4px;
            font-weight: 800;
            color: #374151;
            font-size: 8px;
            white-space: nowrap;
        }

        /* Role Colors */
        .pizzaiolo .worker-role { color: #dc2626; }
        .pizzaiolo { border-left: 3px solid #dc2626; }
        
        .cucina .worker-role { color: #ea580c; }
        .cucina { border-left: 3px solid #ea580c; }
        
        .fattorino .worker-role { color: #0284c7; }
        .fattorino { border-left: 3px solid #0284c7; }
        
        .sala .worker-role { color: #16a34a; }
        .sala { border-left: 3px solid #16a34a; }
        
        .closed-cell {
            background: #fff1f2;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 50px;
            border-radius: 8px;
            border: 2px dashed #fecaca;
        }

        .closed-text {
            color: #be123c;
            font-weight: 900;
            font-size: 12px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .empty-shift {
            text-align: center;
            color: #9ca3af;
            font-style: italic;
            padding: 8px;
            font-size: 9px;
        }
        
        .footer {
            margin-top: 15px;
            padding: 10px;
            background: #f9fafb;
            border-radius: 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 9px;
            color: #6b7280;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-logo">
                <div class="logo-box">P</div>
                <div class="header-text">
                    <h1>Piano di Lavoro Settimanale</h1>
                    <p>PizzaDOC • Gestione Turni</p>
                </div>
            </div>
            <div style="text-align: right">
                <div style="font-size: 14px; font-weight: 900; color: #111827; text-transform: capitalize;">
                    Settimana ${format(weekStart, 'd', { locale: it })} - ${format(weekEnd, 'd MMMM yyyy', { locale: it })}
                </div>
                <div style="font-size: 10px; color: #6b7280; font-weight: 600;">Emesso il ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
            </div>
        </div>

        <table class="schedule-table">
            <thead>
                <tr>
                    <th>Giorno</th>
                    <th>Pranzo (11:30 - 14:00)</th>
                    <th>Cena (18:00 - 22:30)</th>
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
                        <div class="day-date">${format(dayDate, 'dd MMMM', { locale: it })}</div>
                    </td>
                    <td class="shift-cell">
                        ${isPranzoHoliday ? `
                        <div class="closed-cell">
                            <span class="closed-text">🔒 Chiuso</span>
                        </div>
                        ` : pranzoShifts.length > 0 ? `
                        <div class="workers-grid">
                            ${pranzoShifts.map(shift => `
                            <div class="worker-item ${shift.role.toLowerCase()}">
                                <div class="worker-info">
                                    <span class="worker-name">${shift.user.username}</span>
                                    <span class="worker-role">${getRoleShort(shift.role)}</span>
                                </div>
                                <span class="worker-time">${shift.startTime}</span>
                            </div>
                            `).join('')}
                        </div>
                        ` : `
                        <div class="empty-shift">-</div>
                        `}
                    </td>
                    <td class="shift-cell">
                        ${isCenaHoliday ? `
                        <div class="closed-cell">
                            <span class="closed-text">🔒 Chiuso</span>
                        </div>
                        ` : cenaShifts.length > 0 ? `
                        <div class="workers-grid">
                            ${cenaShifts.map(shift => `
                            <div class="worker-item ${shift.role.toLowerCase()}">
                                <div class="worker-info">
                                    <span class="worker-name">${shift.user.username}</span>
                                    <span class="worker-role">${getRoleShort(shift.role)}</span>
                                </div>
                                <span class="worker-time">${shift.startTime}</span>
                            </div>
                            `).join('')}
                        </div>
                        ` : `
                        <div class="empty-shift">-</div>
                        `}
                    </td>
                </tr>
                  `
  }).join('')}
            </tbody>
        </table>

        <div class="footer">
            PizzaDOC Gestione Turni © ${new Date().getFullYear()} • www.pizzadoc.it
        </div>
    </div>
</body>
</html>
  `
}

function getRoleShort(role: string): string {
  const roleShorts: Record<string, string> = {
    'FATTORINO': 'FATT',
    'CUCINA': 'CUC',
    'SALA': 'SALA',
    'PIZZAIOLO': 'PIZZ'
  }
  return roleShorts[role] || role
}
