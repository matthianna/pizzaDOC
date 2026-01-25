import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { normalizeDate } from '@/lib/normalize-date'
import puppeteer from 'puppeteer'

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

    // Genera PDF usando Puppeteer
    let browser
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      
      // Genera il PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: false,
        printBackground: true,
        margin: {
          top: '12mm',
          right: '12mm',
          bottom: '12mm',
          left: '12mm'
        }
      })

      await browser.close()

      // Restituisci il PDF
      const fileName = `Piano-Lavoro-${format(weekStart, 'yyyy-MM-dd', { locale: it })}.pdf`
      
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': pdfBuffer.length.toString()
        }
      })
    } catch (error) {
      console.error('Error generating PDF:', error)
      if (browser) {
        await browser.close()
      }
      return NextResponse.json(
        { error: 'Errore durante la generazione del PDF', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      )
    }
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
  const daysFull = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

  // Group shifts by day, type, and role
  const shiftsByDayTypeRole: Record<number, Record<string, Record<string, Array<{
    startTime: string;
    user: { username: string };
  }>>>> = {}

  for (let day = 0; day <= 6; day++) {
    shiftsByDayTypeRole[day] = {
      'PRANZO': { 'CUCINA': [], 'PIZZAIOLO': [], 'FATTORINO': [], 'SALA': [] },
      'CENA': { 'CUCINA': [], 'PIZZAIOLO': [], 'FATTORINO': [], 'SALA': [] }
    }
  }

  schedule.shifts.forEach(shift => {
    if (shift.user && shiftsByDayTypeRole[shift.dayOfWeek]?.[shift.shiftType]?.[shift.role]) {
      shiftsByDayTypeRole[shift.dayOfWeek][shift.shiftType][shift.role].push({
        startTime: shift.startTime,
        user: shift.user
      })
    }
  })

  // Sort by start time
  for (let day = 0; day <= 6; day++) {
    ['PRANZO', 'CENA'].forEach(shiftType => {
      ['CUCINA', 'PIZZAIOLO', 'FATTORINO', 'SALA'].forEach(role => {
        shiftsByDayTypeRole[day][shiftType][role].sort((a, b) => 
          a.startTime.localeCompare(b.startTime)
        )
      })
    })
  }

  const totalShifts = schedule.shifts.length
  const uniqueUsers = new Set(schedule.shifts.map(s => s.user.username))
  const totalEmployees = uniqueUsers.size

  const roleLabels: Record<string, string> = {
    'CUCINA': 'Cucina',
    'PIZZAIOLO': 'Pizzaiolo', 
    'FATTORINO': 'Fattorino',
    'SALA': 'Sala'
  }

  const roleColors: Record<string, string> = {
    'CUCINA': '#ea580c',
    'PIZZAIOLO': '#dc2626',
    'FATTORINO': '#3b82f6',
    'SALA': '#22c55e'
  }

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Piano Lavoro ${format(weekStart, 'dd/MM', { locale: it })} - ${format(weekEnd, 'dd/MM/yyyy', { locale: it })}</title>
    <style>
        @page { size: A4 portrait; margin: 12mm; }
        @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body { 
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 10px;
            color: #333;
            background: #fff;
            line-height: 1.3;
        }
        
        .container { padding: 0; }
        
        /* Header */
        .header {
            text-align: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 3px solid #ea580c;
        }
        
        .header h1 {
            font-size: 22px;
            font-weight: 700;
            color: #ea580c;
            margin-bottom: 4px;
            letter-spacing: -0.5px;
        }
        
        .header .dates {
            font-size: 12px;
            color: #666;
            font-weight: 500;
        }
        
        /* Day Section */
        .day-section {
            margin-bottom: 8px;
            page-break-inside: avoid;
        }
        
        .day-header {
            display: flex;
            background: #1e293b;
            color: white;
            padding: 6px 12px;
            font-weight: 700;
            font-size: 11px;
        }
        
        .day-name {
            width: 100px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .shift-header {
            flex: 1;
            text-align: center;
            font-size: 10px;
        }
        
        .day-content {
            display: flex;
            border: 1px solid #e5e7eb;
            border-top: none;
        }
        
        .day-label {
            width: 100px;
            background: #f8fafc;
            padding: 8px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border-right: 1px solid #e5e7eb;
        }
        
        .day-label .date {
            font-size: 18px;
            font-weight: 700;
            color: #ea580c;
        }
        
        .day-label .month {
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
        }
        
        .shift-column {
            flex: 1;
            padding: 6px 8px;
            min-height: 70px;
            border-right: 1px solid #e5e7eb;
        }
        
        .shift-column:last-child {
            border-right: none;
        }
        
        .shift-column.pranzo {
            background: #fffbeb;
        }
        
        .shift-column.cena {
            background: #f0f9ff;
        }
        
        .role-group {
            margin-bottom: 4px;
        }
        
        .role-group:last-child {
            margin-bottom: 0;
        }
        
        .role-label {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 2px;
            padding: 2px 6px;
            border-radius: 3px;
            display: inline-block;
        }
        
        .role-label.cucina { background: #fed7aa; color: #9a3412; }
        .role-label.pizzaiolo { background: #fecaca; color: #991b1b; }
        .role-label.fattorino { background: #bfdbfe; color: #1e40af; }
        .role-label.sala { background: #bbf7d0; color: #166534; }
        
        .workers {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            margin-left: 2px;
        }
        
        .worker {
            font-size: 9px;
            color: #374151;
            background: white;
            padding: 2px 5px;
            border-radius: 3px;
            border: 1px solid #e5e7eb;
        }
        
        .worker .time {
            color: #9ca3af;
            font-size: 8px;
            margin-left: 2px;
        }
        
        .closed {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 60px;
            color: #dc2626;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: #fef2f2;
            border: 2px dashed #fca5a5;
            border-radius: 6px;
        }
        
        /* Footer */
        .footer {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            color: #64748b;
        }
        
        .legend {
            display: flex;
            gap: 12px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .legend-dot {
            width: 10px;
            height: 10px;
            border-radius: 2px;
        }
        
        .stats {
            text-align: right;
        }
        
        .stats strong {
            color: #1e293b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍕 Piano di Lavoro Settimanale</h1>
            <div class="dates">${format(weekStart, 'd MMMM', { locale: it })} — ${format(weekEnd, 'd MMMM yyyy', { locale: it })}</div>
        </div>

        ${daysFull.map((dayName, dayIndex) => {
          const dayDate = addDays(weekStart, dayIndex)
          const dayDateStr = dayDate.toISOString().split('T')[0]
          
          const isPranzoHoliday = holidays.some(h => {
            const hDate = new Date(h.date).toISOString().split('T')[0]
            return hDate === dayDateStr && (h.closureType === 'FULL_DAY' || h.closureType === 'PRANZO_ONLY')
          })
          const isCenaHoliday = holidays.some(h => {
            const hDate = new Date(h.date).toISOString().split('T')[0]
            return hDate === dayDateStr && (h.closureType === 'FULL_DAY' || h.closureType === 'CENA_ONLY')
          })

          const renderShift = (shiftType: string, isHoliday: boolean) => {
            if (isHoliday) {
              return '<div class="closed">Chiuso</div>'
            }

            const roles = ['CUCINA', 'PIZZAIOLO', 'FATTORINO', 'SALA']
            const hasAnyWorkers = roles.some(r => 
              shiftsByDayTypeRole[dayIndex][shiftType][r].length > 0
            )

            if (!hasAnyWorkers) {
              return '<div style="color: #9ca3af; font-style: italic; text-align: center; padding: 20px;">—</div>'
            }

            return roles.map(role => {
              const workers = shiftsByDayTypeRole[dayIndex][shiftType][role]
              if (workers.length === 0) return ''
              
              return `
                <div class="role-group">
                  <span class="role-label ${role.toLowerCase()}">${roleLabels[role]}</span>
                  <div class="workers">
                    ${workers.map(w => `<span class="worker">${w.user.username}<span class="time">${w.startTime}</span></span>`).join('')}
                  </div>
                </div>
              `
            }).join('')
          }

          return `
            <div class="day-section">
              <div class="day-header">
                <div class="day-name">${dayName}</div>
                <div class="shift-header">☀️ Pranzo</div>
                <div class="shift-header">🌙 Cena</div>
              </div>
              <div class="day-content">
                <div class="day-label">
                  <div class="date">${format(dayDate, 'd', { locale: it })}</div>
                  <div class="month">${format(dayDate, 'MMM', { locale: it })}</div>
                </div>
                <div class="shift-column pranzo">
                  ${renderShift('PRANZO', isPranzoHoliday)}
                </div>
                <div class="shift-column cena">
                  ${renderShift('CENA', isCenaHoliday)}
                </div>
              </div>
            </div>
          `
        }).join('')}

        <div class="footer">
            <div class="legend">
                <div class="legend-item"><span class="legend-dot" style="background: #ea580c;"></span> Cucina</div>
                <div class="legend-item"><span class="legend-dot" style="background: #dc2626;"></span> Pizzaiolo</div>
                <div class="legend-item"><span class="legend-dot" style="background: #3b82f6;"></span> Fattorino</div>
                <div class="legend-item"><span class="legend-dot" style="background: #22c55e;"></span> Sala</div>
            </div>
            <div class="stats">
                <strong>${totalShifts}</strong> turni assegnati • <strong>${totalEmployees}</strong> dipendenti
            </div>
        </div>
    </div>
</body>
</html>
  `
}
