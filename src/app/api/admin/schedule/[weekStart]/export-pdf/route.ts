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
            margin: 15mm;
        }
        
        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
        }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            line-height: 1.3;
            color: #1f2937;
            background: white;
        }
        
        .container {
            max-width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f97316;
        }
        
        .title {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 5px;
        }
        
        .subtitle {
            font-size: 14px;
            color: #6b7280;
        }
        
        .week-container {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 8px;
            min-height: 0;
        }
        
        .day-column {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
            background: white;
            display: flex;
            flex-direction: column;
        }
        
        .day-header {
            background: linear-gradient(135deg, #f97316, #ea580c);
            color: white;
            padding: 8px 6px;
            text-align: center;
            font-weight: 600;
            font-size: 11px;
        }
        
        .day-date {
            font-size: 9px;
            opacity: 0.9;
            margin-top: 2px;
        }
        
        .day-content {
            flex: 1;
            padding: 6px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .shift-section {
            background: #f8fafc;
            border-radius: 4px;
            padding: 6px;
        }
        
        .shift-title {
            font-weight: 600;
            color: #374151;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .shift-time {
            color: #f97316;
            font-weight: 500;
        }
        
        .workers-list {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        
        .worker {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 6px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-size: 9px;
        }
        
        .worker-info {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }
        
        .worker-name {
            font-weight: 600;
            color: #1f2937;
        }
        
        .worker-role {
            color: #6b7280;
            text-transform: uppercase;
            font-size: 8px;
            letter-spacing: 0.3px;
        }
        
        .worker-time {
            font-weight: 600;
            color: #f97316;
            font-size: 9px;
        }
        
        .empty-shift {
            text-align: center;
            color: #9ca3af;
            font-style: italic;
            padding: 12px 6px;
            font-size: 9px;
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