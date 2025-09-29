import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
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
                id: true,
                username: true,
                primaryRole: true
              }
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { shiftType: 'asc' },
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
    };
  }>;
}, weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  // Raggruppa i turni per giorno e tipo
  const shiftsByDay: Record<number, Record<string, Array<{
    id: string;
    role: string;
    startTime: string;
    user: {
      username: string;
    };
  }>>> = {}
  
  for (let day = 1; day <= 7; day++) {
    shiftsByDay[day] = { PRANZO: [], CENA: [] }
  }

  schedule.shifts.forEach((shift) => {
    const dayIndex = shift.dayOfWeek === 0 ? 7 : shift.dayOfWeek // Domenica = 0 -> 7
    shiftsByDay[dayIndex][shift.shiftType].push(shift)
  })

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Piano di Lavoro - ${format(weekStart, 'dd/MM/yyyy', { locale: it })}</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 30px;
            font-size: 14px;
            line-height: 1.5;
            color: #1f2937;
            background: white;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #f97316;
        }
        
        .title {
            font-size: 28px;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 8px 0;
        }
        
        .subtitle {
            font-size: 16px;
            color: #6b7280;
            margin: 0;
        }
        
        .week-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .day-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            background: white;
        }
        
        .day-header {
            background: #f97316;
            color: white;
            padding: 12px;
            text-align: center;
            font-weight: 600;
            font-size: 15px;
        }
        
        .day-date {
            font-size: 12px;
            opacity: 0.9;
            margin-top: 2px;
        }
        
        .shift-section {
            padding: 16px;
        }
        
        .shift-title {
            font-weight: 600;
            color: #374151;
            margin: 0 0 12px 0;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .shift-time {
            color: #6b7280;
            font-size: 11px;
            margin-left: 4px;
        }
        
        .person-list {
            space-y: 8px;
        }
        
        .person {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            margin-bottom: 6px;
        }
        
        .person-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .person-name {
            font-weight: 500;
            color: #1f2937;
            font-size: 13px;
        }
        
        .person-start-time {
            font-size: 11px;
            color: #f97316;
            font-weight: 600;
        }
        
        .person-role {
            font-size: 11px;
            color: #6b7280;
            background: #e5e7eb;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        
        .empty-shift {
            text-align: center;
            color: #9ca3af;
            font-style: italic;
            padding: 20px;
            font-size: 12px;
        }
        
        .summary {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin-top: 40px;
            text-align: center;
        }
        
        .summary-title {
            font-weight: 600;
            color: #374151;
            margin: 0 0 12px 0;
        }
        
        .summary-stats {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin: 16px 0;
        }
        
        .stat {
            text-align: center;
        }
        
        .stat-number {
            font-size: 24px;
            font-weight: 700;
            color: #f97316;
            margin: 0;
        }
        
        .stat-label {
            font-size: 12px;
            color: #6b7280;
            margin: 4px 0 0 0;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #9ca3af;
            font-size: 12px;
        }
        
        @media print {
            body { padding: 20px; }
            .week-grid { gap: 15px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">Piano di Lavoro</h1>
        <p class="subtitle">Settimana ${format(weekStart, 'dd/MM/yyyy', { locale: it })} - ${format(weekEnd, 'dd/MM/yyyy', { locale: it })}</p>
    </div>

    <div class="week-grid">
        ${days.map((day, dayIndex) => {
          const dayNum = dayIndex + 1
          const currentDate = new Date(weekStart)
          currentDate.setDate(currentDate.getDate() + dayIndex)
          
          const pranzaShifts = shiftsByDay[dayNum]?.PRANZO || []
          const cenaShifts = shiftsByDay[dayNum]?.CENA || []
          
          return `
            <div class="day-card">
                <div class="day-header">
                    ${day}
                    <div class="day-date">${format(currentDate, 'dd/MM', { locale: it })}</div>
                </div>
                
                <div class="shift-section">
                    <h3 class="shift-title">
                        Pranzo 
                        <span class="shift-time">11:00-14:00</span>
                    </h3>
                    <div class="person-list">
                        ${pranzaShifts.length > 0 
                          ? pranzaShifts.map((shift) => `
                              <div class="person">
                                  <div class="person-info">
                                      <span class="person-name">${shift.user.username}</span>
                                      <span class="person-start-time">${shift.startTime}</span>
                                  </div>
                                  <span class="person-role">${shift.role}</span>
                              </div>
                            `).join('')
                          : '<div class="empty-shift">Nessuno</div>'
                        }
                    </div>
                </div>
                
                <div class="shift-section">
                    <h3 class="shift-title">
                        Cena 
                        <span class="shift-time">17:00-22:00</span>
                    </h3>
                    <div class="person-list">
                        ${cenaShifts.length > 0 
                          ? cenaShifts.map((shift) => `
                              <div class="person">
                                  <div class="person-info">
                                      <span class="person-name">${shift.user.username}</span>
                                      <span class="person-start-time">${shift.startTime}</span>
                                  </div>
                                  <span class="person-role">${shift.role}</span>
                              </div>
                            `).join('')
                          : '<div class="empty-shift">Nessuno</div>'
                        }
                    </div>
                </div>
            </div>
          `
        }).join('')}
    </div>

    <div class="summary">
        <h2 class="summary-title">Riepilogo Settimanale</h2>
        <div class="summary-stats">
            <div class="stat">
                <div class="stat-number">${schedule.shifts.length}</div>
                <div class="stat-label">Turni Totali</div>
            </div>
            <div class="stat">
                <div class="stat-number">${new Set(schedule.shifts.map((s) => s.userId)).size}</div>
                <div class="stat-label">Persone</div>
            </div>
        </div>
    </div>

    <div class="footer">
        Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })} • PizzaDOC
    </div>
</body>
</html>
  `
}
