import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import {
  addWeekCalendarDays,
  ensureUtcMondayWeekStart,
  formatUtcMonthAbbrevIt,
  formatUtcWeekSubtitleIt,
  utcCalendarDateKey,
} from '@/lib/date-utils'
import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

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
    const dayMs = 24 * 60 * 60 * 1000
    const weekStartCandidates = [
      normalizeDate(new Date(rawWeekStart.getTime() - dayMs)),
      rawWeekStart,
      normalizeDate(new Date(rawWeekStart.getTime() + dayMs)),
    ]

    const scheduleRows = await prisma.schedules.findMany({
      where: { weekStart: { in: weekStartCandidates } },
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

    const schedule =
      scheduleRows.length === 0
        ? null
        : scheduleRows.reduce((best, cur) =>
            Math.abs(cur.weekStart.getTime() - rawWeekStart.getTime()) <=
            Math.abs(best.weekStart.getTime() - rawWeekStart.getTime())
              ? cur
              : best
          )

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Lunedì operativo UTC + range coerente con /weekly-plan (DB a volte ha domenica come anchor)
    const weekStart = ensureUtcMondayWeekStart(normalizeDate(schedule.weekStart))
    const weekEnd = addWeekCalendarDays(weekStart, 6)
    const holidays = await prisma.holidays.findMany({
      where: {
        date: {
          gte: weekStart,
          lte: weekEnd
        }
      }
    })

    // Genera l'HTML per il PDF
    const html = generateScheduleHTML(schedule, weekStart, holidays)

    // Genera PDF usando Puppeteer (serverless-compatible)
    let browser
    try {
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
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
      const fileName = `Piano-Lavoro-${utcCalendarDateKey(weekStart)}.pdf`
      
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function closureHintIt(closureType: string): string {
  switch (closureType) {
    case 'FULL_DAY':
      return 'Chiusura: tutto il giorno'
    case 'PRANZO_ONLY':
      return 'Solo pranzo chiuso'
    case 'CENA_ONLY':
      return 'Solo cena chiusa'
    default:
      return ''
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

  const weekEnd = addWeekCalendarDays(weekStart, 6)
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
    <title>Piano Lavoro ${utcCalendarDateKey(weekStart)} — ${utcCalendarDateKey(weekEnd)}</title>
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

        .festa-bar {
            background: linear-gradient(90deg, #fef3c7, #fde68a);
            border: 1px solid #f59e0b;
            border-radius: 4px;
            padding: 4px 8px;
            margin: 0 0 6px 0;
            font-size: 9px;
            font-weight: 700;
            color: #92400e;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        .festa-desc {
            font-weight: 600;
            text-transform: none;
            color: #78350f;
            margin-top: 2px;
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍕 Piano di Lavoro Settimanale</h1>
            <div class="dates">${formatUtcWeekSubtitleIt(weekStart, weekEnd)}</div>
        </div>

        ${daysFull.map((dayName, dayIndex) => {
          const dayDate = addWeekCalendarDays(weekStart, dayIndex)
          const dayKey = utcCalendarDateKey(dayDate)

          const dayHolidays = holidays.filter(
            h => utcCalendarDateKey(normalizeDate(h.date)) === dayKey
          )

          const isPranzoHoliday = dayHolidays.some(
            h => h.closureType === 'FULL_DAY' || h.closureType === 'PRANZO_ONLY'
          )
          const isCenaHoliday = dayHolidays.some(
            h => h.closureType === 'FULL_DAY' || h.closureType === 'CENA_ONLY'
          )

          const festaBlock =
            dayHolidays.length > 0
              ? `<div class="festa-bar">Festa${dayHolidays
                  .map(h =>
                    h.description
                      ? `<span class="festa-desc">${escapeHtml(h.description)}${
                          h.closureType === 'FULL_DAY'
                            ? ' (tutto il giorno)'
                            : h.closureType === 'PRANZO_ONLY'
                              ? ' (solo pranzo)'
                              : h.closureType === 'CENA_ONLY'
                                ? ' (solo cena)'
                                : ''
                        }</span>`
                      : `<span class="festa-desc">${closureHintIt(h.closureType)}</span>`
                  )
                  .join('')}</div>`
              : ''

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
              ${festaBlock}
              <div class="day-content">
                <div class="day-label">
                  <div class="date">${dayDate.getUTCDate()}</div>
                  <div class="month">${formatUtcMonthAbbrevIt(dayDate)}</div>
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
    </div>
</body>
</html>
  `
}
