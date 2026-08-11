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
import { resolveScheduleForRequestedWeek } from '@/lib/resolve-schedule-for-week'
import {
  PDF_COLORS,
  PDF_BRAND,
  pdfBaseStyles,
  pdfDocHeader,
  pdfDocFooter,
  escapePdfHtml,
} from '@/lib/pdf-fornace-styles'
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
        : resolveScheduleForRequestedWeek(scheduleRows, rawWeekStart)

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

  for (let day = 0; day <= 6; day++) {
    ;['PRANZO', 'CENA'].forEach(shiftType => {
      ;['CUCINA', 'PIZZAIOLO', 'FATTORINO', 'SALA'].forEach(role => {
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

  const c = PDF_COLORS
  const generatedAt = `Generato il ${new Date().toLocaleString('it-IT')}`

  return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Piano lavoro ${utcCalendarDateKey(weekStart)} — ${PDF_BRAND}</title>
    <style>
        ${pdfBaseStyles(`
        body { font-size: 10px; }
        .stat-strip { grid-template-columns: repeat(2, 1fr); margin-bottom: 14px; }
        .day-section {
            margin-bottom: 8px;
            page-break-inside: avoid;
            border: 1px solid ${c.border};
            border-radius: 10px;
            overflow: hidden;
        }
        .day-header {
            display: flex;
            background: ${c.surfaceMuted};
            color: ${c.text};
            padding: 7px 12px;
            font-weight: 600;
            font-size: 11px;
            border-bottom: 1px solid ${c.border};
        }
        .day-name {
            width: 100px;
            font-family: Georgia, 'Times New Roman', serif;
        }
        .shift-header {
            flex: 1;
            text-align: center;
            font-size: 10px;
            color: ${c.muted};
            font-weight: 600;
        }
        .day-content { display: flex; }
        .day-label {
            width: 100px;
            background: ${c.surface};
            padding: 8px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border-right: 1px solid ${c.border};
        }
        .day-label .date {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 18px;
            font-weight: 600;
            color: ${c.accent};
        }
        .day-label .month {
            font-size: 9px;
            color: ${c.muted};
            text-transform: uppercase;
        }
        .shift-column {
            flex: 1;
            padding: 6px 8px;
            min-height: 70px;
            border-right: 1px solid ${c.border};
            background: ${c.surface};
        }
        .shift-column:last-child { border-right: none; }
        .shift-column.pranzo { background: #fbf6ee; }
        .shift-column.cena { background: #faf6f2; }
        .role-group { margin-bottom: 4px; }
        .role-group:last-child { margin-bottom: 0; }
        .role-label {
            font-size: 8px;
            font-weight: 600;
            margin-bottom: 2px;
            padding: 2px 6px;
            border-radius: 999px;
            display: inline-block;
            background: ${c.accentSoft};
            color: ${c.accent};
        }
        .workers { display: flex; flex-wrap: wrap; gap: 3px; margin-left: 2px; }
        .worker {
            font-size: 9px;
            color: ${c.text};
            background: ${c.surface};
            padding: 2px 5px;
            border-radius: 4px;
            border: 1px solid ${c.border};
        }
        .worker .time { color: ${c.muted}; font-size: 8px; margin-left: 2px; }
        .closed {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 60px;
            color: ${c.danger};
            font-weight: 600;
            font-size: 11px;
            background: ${c.dangerSoft};
            border: 1px dashed #e8b4b4;
            border-radius: 8px;
        }
        .empty-slot {
            color: ${c.muted};
            font-style: italic;
            text-align: center;
            padding: 18px 8px;
        }
        .festa-bar {
            background: ${c.warningSoft};
            border-bottom: 1px solid ${c.border};
            padding: 5px 10px;
            font-size: 9px;
            font-weight: 600;
            color: ${c.warning};
        }
        .festa-desc {
            font-weight: 500;
            color: ${c.text};
            margin-top: 2px;
            display: block;
        }
        `)}
    </style>
</head>
<body>
    ${pdfDocHeader({
      title: 'Piano di lavoro settimanale',
      subtitle: formatUtcWeekSubtitleIt(weekStart, weekEnd),
    })}

    <div class="stat-strip">
      <div class="cell">
        <div class="pd-display value">${totalShifts}</div>
        <div class="label">Turni</div>
      </div>
      <div class="cell">
        <div class="pd-display value">${totalEmployees}</div>
        <div class="label">Persone in servizio</div>
      </div>
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
          ? `<div class="festa-bar">Festività${dayHolidays
              .map(h =>
                h.description
                  ? `<span class="festa-desc">${escapePdfHtml(h.description)}${
                      h.closureType === 'FULL_DAY'
                        ? ' (tutto il giorno)'
                        : h.closureType === 'PRANZO_ONLY'
                          ? ' (solo pranzo)'
                          : h.closureType === 'CENA_ONLY'
                            ? ' (solo cena)'
                            : ''
                    }</span>`
                  : `<span class="festa-desc">${escapePdfHtml(closureHintIt(h.closureType))}</span>`
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
          return '<div class="empty-slot">—</div>'
        }

        return roles.map(role => {
          const workers = shiftsByDayTypeRole[dayIndex][shiftType][role]
          if (workers.length === 0) return ''

          return `
            <div class="role-group">
              <span class="role-label">${roleLabels[role]}</span>
              <div class="workers">
                ${workers.map(w => `<span class="worker">${escapePdfHtml(w.user.username)}<span class="time">${escapePdfHtml(w.startTime)}</span></span>`).join('')}
              </div>
            </div>
          `
        }).join('')
      }

      return `
        <div class="day-section">
          <div class="day-header">
            <div class="day-name">${dayName}</div>
            <div class="shift-header">Pranzo</div>
            <div class="shift-header">Cena</div>
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

    ${pdfDocFooter(generatedAt)}
</body>
</html>
  `
}
