import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format, addDays, startOfWeek } from 'date-fns'
import { it } from 'date-fns/locale'

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
    const rawWeekStart = new Date(resolvedParams.weekStart)
    
    // Query con la data dal database
    const schedule = await prisma.schedule.findUnique({
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
    
    // NORMALIZZA a LUNEDÌ (la weekStart dal DB potrebbe essere domenica)
    const dbWeekStart = new Date(schedule.weekStart)
    const weekStart = startOfWeek(dbWeekStart, { weekStartsOn: 1 })
    
    // Genera l'HTML per il PDF
    const html = generateScheduleHTML(schedule, weekStart)

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
      primaryRole: string;
    };
  }>;
  weekStart: Date;
}, weekStart: Date): string {
  
  const weekEnd = addDays(weekStart, 6)
  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  
  // Raggruppa turni per giorno e tipo (0=Lunedì, 6=Domenica)
  const shiftsByDayAndType: Record<number, Record<string, Array<{
    role: string;
    startTime: string;
    user: {
      username: string;
      primaryRole: string;
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
            margin: 15mm;
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
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #000;
            background: white;
        }
        
        .container {
            width: 100%;
        }
        
        .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 3px solid #000;
        }
        
        .title {
            font-size: 24px;
            font-weight: 700;
            color: #000;
            margin-bottom: 5px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        
        .subtitle {
            font-size: 14px;
            color: #333;
            font-weight: 500;
            margin-top: 5px;
        }
        
        .schedule-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        
        .schedule-table th {
            background: #000;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 2px solid #000;
        }
        
        .schedule-table th:first-child {
            width: 15%;
            text-align: center;
        }
        
        .schedule-table th:nth-child(2),
        .schedule-table th:nth-child(3) {
            width: 42.5%;
        }
        
        .schedule-table td {
            padding: 8px;
            border: 1px solid #333;
            vertical-align: top;
        }
        
        .day-cell {
            background: #f5f5f5;
            text-align: center;
            font-weight: 700;
            font-size: 12px;
        }
        
        .day-name {
            font-size: 13px;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .day-date {
            font-size: 11px;
            color: #555;
            font-weight: 600;
        }
        
        .shift-cell {
            background: white;
            min-height: 60px;
        }
        
        .shift-time {
            font-weight: 700;
            color: #000;
            font-size: 10px;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid #ddd;
            text-transform: uppercase;
        }
        
        .workers-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 3px;
        }
        
        .worker-item {
            padding: 4px 5px;
            background: #fafafa;
            border-left: 3px solid #666;
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 8px;
        }
        
        .worker-item.pizzaiolo {
            border-left-color: #dc2626;
            background: #fef2f2;
        }
        
        .worker-item.cucina {
            border-left-color: #ea580c;
            background: #fff7ed;
        }
        
        .worker-item.fattorino {
            border-left-color: #0284c7;
            background: #f0f9ff;
        }
        
        .worker-item.sala {
            border-left-color: #16a34a;
            background: #f0fdf4;
        }
        
        .worker-name {
            font-weight: 700;
            color: #000;
            font-size: 9px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .worker-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .worker-role {
            font-size: 7px;
            text-transform: uppercase;
            color: #666;
            font-weight: 600;
        }
        
        .worker-time {
            font-weight: 700;
            color: #000;
            font-size: 8px;
            white-space: nowrap;
        }
        
        .empty-shift {
            text-align: center;
            color: #999;
            font-style: italic;
            padding: 15px 8px;
            font-size: 10px;
        }
        
        .footer {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid #ccc;
            text-align: center;
            font-size: 9px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🍕 Piano di Lavoro Settimanale</h1>
            <p class="subtitle">Dal ${format(weekStart, 'EEEE d MMMM', { locale: it })} al ${format(weekEnd, 'EEEE d MMMM yyyy', { locale: it })}</p>
        </div>

        <table class="schedule-table">
            <thead>
                <tr>
                    <th>GIORNO</th>
                    <th>PRANZO (11:00 - 14:00)</th>
                    <th>CENA (17:00 - 22:00)</th>
                </tr>
            </thead>
            <tbody>
                ${days.map((dayName, dayIndex) => {
                  // Calcola la data CORRETTA per questo giorno
                  const dayDate = addDays(weekStart, dayIndex)
                  const pranzoShifts = shiftsByDayAndType[dayIndex]['PRANZO'] || []
                  const cenaShifts = shiftsByDayAndType[dayIndex]['CENA'] || []
                  
                  return `
                <tr>
                    <td class="day-cell">
                        <div class="day-name">${dayName}</div>
                        <div class="day-date">${format(dayDate, 'dd/MM')}</div>
                    </td>
                    <td class="shift-cell">
                        ${pranzoShifts.length > 0 ? `
                        <div class="workers-grid">
                            ${pranzoShifts.map(shift => `
                            <div class="worker-item ${shift.role.toLowerCase()}">
                                <div class="worker-name">${shift.user.username}</div>
                                <div class="worker-meta">
                                    <span class="worker-role">${getRoleShort(shift.role)}</span>
                                    <span class="worker-time">${shift.startTime}</span>
                                </div>
                            </div>
                            `).join('')}
                        </div>
                        ` : `
                        <div class="empty-shift">-</div>
                        `}
                    </td>
                    <td class="shift-cell">
                        ${cenaShifts.length > 0 ? `
                        <div class="workers-grid">
                            ${cenaShifts.map(shift => `
                            <div class="worker-item ${shift.role.toLowerCase()}">
                                <div class="worker-name">${shift.user.username}</div>
                                <div class="worker-meta">
                                    <span class="worker-role">${getRoleShort(shift.role)}</span>
                                    <span class="worker-time">${shift.startTime}</span>
                                </div>
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
            Piano di lavoro generato il ${format(new Date(), 'dd/MM/yyyy')} alle ${format(new Date(), 'HH:mm', { locale: it })} • Turni: ${totalWorkers} • Dipendenti: ${uniqueWorkers}
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
