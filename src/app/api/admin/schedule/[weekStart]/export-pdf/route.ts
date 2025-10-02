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
            size: A4 landscape;
            margin: 12mm 10mm;
        }
        
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            body {
                width: 277mm;
                height: 190mm;
            }
        }
        
        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
        }
        
        body { 
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 9px;
            line-height: 1.2;
            color: #000;
            background: white;
        }
        
        .container {
            width: 100%;
            height: 100%;
        }
        
        .header {
            text-align: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 3px solid #000;
        }
        
        .title {
            font-size: 20px;
            font-weight: 700;
            color: #000;
            margin-bottom: 3px;
            letter-spacing: 0.5px;
        }
        
        .subtitle {
            font-size: 12px;
            color: #333;
            font-weight: 500;
        }
        
        .week-container {
            display: table;
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
        }
        
        .day-column {
            display: table-cell;
            width: 14.28%;
            border: 2px solid #000;
            border-right: none;
            vertical-align: top;
        }
        
        .day-column:last-child {
            border-right: 2px solid #000;
        }
        
        .day-header {
            background: #000;
            color: white;
            padding: 6px 4px;
            text-align: center;
            font-weight: 700;
            font-size: 10px;
            letter-spacing: 0.5px;
        }
        
        .day-date {
            font-size: 8px;
            margin-top: 2px;
            font-weight: 400;
        }
        
        .day-content {
            padding: 4px;
        }
        
        .shift-section {
            margin-bottom: 6px;
            page-break-inside: avoid;
        }
        
        .shift-section:last-child {
            margin-bottom: 0;
        }
        
        .shift-title {
            font-weight: 700;
            color: #000;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
            padding-bottom: 3px;
            border-bottom: 1px solid #999;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .shift-time {
            color: #000;
            font-weight: 700;
            font-size: 8px;
        }
        
        .workers-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .worker {
            padding: 3px 4px;
            background: #f5f5f5;
            border: 1px solid #ccc;
            font-size: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            page-break-inside: avoid;
        }
        
        .worker-info {
            flex: 1;
            min-width: 0;
        }
        
        .worker-name {
            font-weight: 700;
            color: #000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .worker-role {
            color: #555;
            text-transform: uppercase;
            font-size: 7px;
            letter-spacing: 0.3px;
            margin-top: 1px;
        }
        
        .worker-time {
            font-weight: 700;
            color: #000;
            font-size: 8px;
            margin-left: 4px;
            white-space: nowrap;
        }
        
        .empty-shift {
            text-align: center;
            color: #999;
            font-style: italic;
            padding: 8px 4px;
            font-size: 8px;
        }
        
        .summary {
            margin-top: 10px;
            padding: 8px;
            border: 2px solid #000;
            background: #f5f5f5;
            display: flex;
            justify-content: space-around;
            align-items: center;
            page-break-inside: avoid;
        }
        
        .summary-item {
            text-align: center;
        }
        
        .summary-number {
            font-size: 16px;
            font-weight: 700;
            color: #000;
        }
        
        .summary-label {
            font-size: 10px;
            color: #555;
            margin-top: 2px;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🍕 Piano di Lavoro</h1>
            <p class="subtitle">Settimana dal ${format(weekStart, 'dd/MM/yyyy', { locale: it })} al ${format(weekEnd, 'dd/MM/yyyy', { locale: it })}</p>
        </div>

        <div class="week-container">
            ${days.map((dayName, index) => {
              const date = addDays(weekStart, index)
              const dayShifts = shiftsByDay[index] || []
              
              // Raggruppa per turno
              const pranzoShifts = dayShifts.filter(s => s.shiftType === 'PRANZO')
              const cenaShifts = dayShifts.filter(s => s.shiftType === 'CENA')
              
              return `
            <div class="day-column">
                <div class="day-header">
                    ${dayName}
                    <div class="day-date">${format(date, 'dd/MM', { locale: it })}</div>
                </div>
                <div class="day-content">
                    ${pranzoShifts.length > 0 ? `
                    <div class="shift-section">
                        <div class="shift-title">
                            Pranzo
                            <span class="shift-time">11:00-14:00</span>
                        </div>
                        <div class="workers-list">
                            ${pranzoShifts.map(shift => `
                            <div class="worker">
                                <div class="worker-info">
                                    <div class="worker-name">${shift.user.username}</div>
                                    <div class="worker-role">${getRoleShort(shift.role)}</div>
                                </div>
                                <div class="worker-time">${shift.startTime}</div>
                            </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${cenaShifts.length > 0 ? `
                    <div class="shift-section">
                        <div class="shift-title">
                            Cena
                            <span class="shift-time">17:00-22:00</span>
                        </div>
                        <div class="workers-list">
                            ${cenaShifts.map(shift => `
                            <div class="worker">
                                <div class="worker-info">
                                    <div class="worker-name">${shift.user.username}</div>
                                    <div class="worker-role">${getRoleShort(shift.role)}</div>
                                </div>
                                <div class="worker-time">${shift.startTime}</div>
                            </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${pranzoShifts.length === 0 && cenaShifts.length === 0 ? `
                    <div class="empty-shift">Nessun turno assegnato</div>
                    ` : ''}
                </div>
            </div>
              `
            }).join('')}
        </div>

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