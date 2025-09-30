import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format, addDays } from 'date-fns'
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
    const weekStart = new Date(resolvedParams.weekStart)

    const schedule = await prisma.schedule.findUnique({
      where: { weekStart },
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
            { startTime: 'asc' },
            { role: 'asc' }
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
}, weekStart: Date): string {
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  
  // Raggruppa turni per giorno (0=Lunedì, 6=Domenica)
  const shiftsByDay: Record<number, Array<{
    role: string;
    startTime: string;
    shiftType: string;
    user: {
      username: string;
      primaryRole: string;
    };
  }>> = {}
  
  // Inizializza tutti i giorni
  for (let day = 0; day <= 6; day++) {
    shiftsByDay[day] = []
  }

  // Raggruppa SOLO i turni con persone assegnate
  schedule.shifts.forEach(shift => {
    if (shift.user) {
      shiftsByDay[shift.dayOfWeek].push(shift)
    }
  })

  // Calcola statistiche
  const totalWorkers = schedule.shifts.filter(s => s.user).length
  const uniqueWorkers = new Set(schedule.shifts.filter(s => s.user).map(s => s.user.username)).size

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Piano di Lavoro - ${format(weekStart, 'dd/MM/yyyy', { locale: it })}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 15mm;
        }
        
        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
        }
        
        body { 
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: white;
        }
        
        .container {
            max-width: 100%;
            padding: 10px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 3px solid #f97316;
        }
        
        .title {
            font-size: 26px;
            font-weight: bold;
            color: #000;
            margin-bottom: 8px;
        }
        
        .subtitle {
            font-size: 16px;
            color: #333;
            font-weight: 500;
        }
        
        .week-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .week-table th {
            background: #f97316;
            color: white;
            padding: 12px 8px;
            text-align: left;
            font-weight: bold;
            font-size: 14px;
            border: 1px solid #333;
        }
        
        .week-table td {
            padding: 10px 8px;
            border: 1px solid #333;
            vertical-align: top;
            font-size: 12px;
        }
        
        .day-row {
            background: #f8f9fa;
        }
        
        .day-name {
            font-weight: bold;
            color: #000;
            font-size: 14px;
        }
        
        .day-date {
            color: #666;
            font-size: 11px;
            margin-top: 2px;
        }
        
        .shift-content {
            min-height: 60px;
        }
        
        .shift-title {
            font-weight: bold;
            color: #f97316;
            font-size: 13px;
            margin-bottom: 8px;
            text-transform: uppercase;
        }
        
        .worker-list {
            margin: 0;
            padding: 0;
            list-style: none;
        }
        
        .worker-item {
            margin-bottom: 6px;
            padding: 6px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 3px;
        }
        
        .worker-name {
            font-weight: bold;
            color: #000;
            font-size: 12px;
        }
        
        .worker-details {
            font-size: 10px;
            color: #666;
            margin-top: 2px;
        }
        
        .no-workers {
            color: #999;
            font-style: italic;
            text-align: center;
            padding: 20px;
        }
        
        .summary {
            margin-top: 15px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 12px;
            display: flex;
            justify-content: space-around;
            align-items: center;
        }
        
        .summary-item {
            text-align: center;
        }
        
        .summary-number {
            font-size: 18px;
            font-weight: 700;
            color: #f97316;
        }
        
        .summary-label {
            font-size: 10px;
            color: #6b7280;
            margin-top: 2px;
        }
        
        .shift-times {
            font-size: 8px;
            color: #6b7280;
            text-align: center;
            margin-top: 10px;
        }
        
        @media print {
            body { 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .container {
                height: auto;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🍕 Piano di Lavoro</h1>
            <p class="subtitle">Settimana dal ${format(weekStart, 'dd/MM/yyyy', { locale: it })} al ${format(weekEnd, 'dd/MM/yyyy', { locale: it })}</p>
        </div>

        <table class="week-table">
            <thead>
                <tr>
                    <th width="15%">Giorno</th>
                    <th width="42.5%">Pranzo (11:00-14:00)</th>
                    <th width="42.5%">Cena (17:00-22:00)</th>
                </tr>
            </thead>
            <tbody>
                ${days.map((dayName, index) => {
                  const date = addDays(weekStart, index)
                  const dayShifts = shiftsByDay[index] || []
                  
                  // Raggruppa per turno
                  const pranzoShifts = dayShifts.filter(s => s.shiftType === 'PRANZO')
                  const cenaShifts = dayShifts.filter(s => s.shiftType === 'CENA')
                  
                  return `
                <tr class="day-row">
                    <td>
                        <div class="day-name">${dayName}</div>
                        <div class="day-date">${format(date, 'dd/MM/yyyy', { locale: it })}</div>
                    </td>
                    <td class="shift-content">
                        ${pranzoShifts.length > 0 ? `
                        <ul class="worker-list">
                            ${pranzoShifts.map(shift => `
                            <li class="worker-item">
                                <div class="worker-name">${shift.user.username}</div>
                                <div class="worker-details">
                                    ${getRoleShort(shift.role)} - Inizio: ${shift.startTime}
                                </div>
                            </li>
                            `).join('')}
                        </ul>
                        ` : '<div class="no-workers">Nessun dipendente</div>'}
                    </td>
                    <td class="shift-content">
                        ${cenaShifts.length > 0 ? `
                        <ul class="worker-list">
                            ${cenaShifts.map(shift => `
                            <li class="worker-item">
                                <div class="worker-name">${shift.user.username}</div>
                                <div class="worker-details">
                                    ${getRoleShort(shift.role)} - Inizio: ${shift.startTime}
                                </div>
                            </li>
                            `).join('')}
                        </ul>
                        ` : '<div class="no-workers">Nessun dipendente</div>'}
                    </td>
                </tr>
                  `
                }).join('')}
            </tbody>
        </table>

        <div class="summary">
            <div class="summary-item">
                <div class="summary-number">${totalWorkers}</div>
                <div class="summary-label">Turni Totali</div>
            </div>
            <div class="summary-item">
                <div class="summary-number">${uniqueWorkers}</div>
                <div class="summary-label">Dipendenti Coinvolti</div>
            </div>
            <div class="summary-item">
                <div class="summary-number">${Math.round(totalWorkers / 7)}</div>
                <div class="summary-label">Media Turni/Giorno</div>
            </div>
        </div>
        
        <div class="shift-times">
            Orari Standard: Pranzo 11:00-14:00 • Cena 17:00-22:00 • Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}
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