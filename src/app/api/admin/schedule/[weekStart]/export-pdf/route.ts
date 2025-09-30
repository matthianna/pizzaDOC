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
            margin: 10mm;
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
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .day-section {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            background: white;
            page-break-inside: avoid;
        }
        
        .day-header {
            background: linear-gradient(135deg, #f97316, #ea580c);
            color: white;
            padding: 12px 16px;
            font-weight: 700;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .day-content {
            padding: 12px 16px;
        }
        
        .shift-row {
            display: flex;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 15px;
        }
        
        .shift-row:last-child {
            margin-bottom: 0;
        }
        
        .shift-info {
            min-width: 120px;
            flex-shrink: 0;
        }
        
        .shift-title {
            font-weight: 700;
            color: #1f2937;
            font-size: 12px;
            margin-bottom: 2px;
        }
        
        .shift-time {
            color: #6b7280;
            font-size: 10px;
        }
        
        .workers-grid {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 8px;
        }
        
        .worker-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 10px;
        }
        
        .worker-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
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
            font-size: 10px;
        }
        
        .no-workers {
            color: #9ca3af;
            font-style: italic;
            font-size: 10px;
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
            <div class="day-section">
                <div class="day-header">
                    <span>${dayName}</span>
                    <span>${format(date, 'dd/MM', { locale: it })}</span>
                </div>
                <div class="day-content">
                    ${pranzoShifts.length > 0 ? `
                    <div class="shift-row">
                        <div class="shift-info">
                            <div class="shift-title">PRANZO</div>
                            <div class="shift-time">11:00-14:00</div>
                        </div>
                        <div class="workers-grid">
                            ${pranzoShifts.map(shift => `
                            <div class="worker-card">
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
                    <div class="shift-row">
                        <div class="shift-info">
                            <div class="shift-title">CENA</div>
                            <div class="shift-time">17:00-22:00</div>
                        </div>
                        <div class="workers-grid">
                            ${cenaShifts.map(shift => `
                            <div class="worker-card">
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