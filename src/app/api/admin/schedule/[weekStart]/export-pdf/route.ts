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
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
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
  const daysUpper = ['LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO', 'DOMENICA']

  // Funzione helper per ottenere codice ruolo
  const getRoleCode = (role: string): string => {
    const roleMap: Record<string, string> = {
      'CUCINA': 'CUC',
      'PIZZAIOLO': 'PIZZ',
      'FATTORINO': 'FATT',
      'SALA': 'SALA'
    }
    return roleMap[role] || role.substring(0, 4).toUpperCase()
  }

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
  const totalShifts = schedule.shifts.length
  const uniqueUsers = new Set(schedule.shifts.map(s => s.userId))
  const totalEmployees = uniqueUsers.size
  const generationDate = new Date()

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
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 10px;
            line-height: 1.4;
            color: #000;
            background: white;
            padding: 0;
            margin: 0;
        }
        
        .container {
            width: 100%;
            max-width: 100%;
            padding: 3px;
            box-sizing: border-box;
        }
        
        .header {
            text-align: center;
            margin-bottom: 10px;
            padding: 8px;
            background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%);
            border-radius: 5px;
            box-shadow: 0 2px 8px rgba(234, 88, 12, 0.3);
        }

        .header h1 {
            font-size: 16px;
            font-weight: 900;
            color: #ffffff;
            text-transform: uppercase;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .header .subtitle {
            font-size: 9px;
            color: #fff7ed;
            font-weight: 600;
            margin-top: 3px;
        }
        
        .pizza-icon {
            font-size: 20px;
        }

        .schedule-table {
            width: 100%;
            max-width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
            table-layout: fixed;
            margin-bottom: 6px;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .schedule-table th {
            background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
            color: #ffffff;
            padding: 5px 3px;
            text-align: center;
            font-weight: 900;
            font-size: 8px;
            text-transform: uppercase;
            border: 1px solid #1e293b;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .schedule-table th:first-child { 
            width: 15%;
        }
        
        .schedule-table th:nth-child(2),
        .schedule-table th:nth-child(3) {
            width: 42.5%;
        }
        
        .day-row td {
            vertical-align: top;
            border: 1px solid #000;
            padding: 4px 3px;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .day-cell {
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            text-align: center;
            font-weight: 700;
        }
        
        .day-name {
            font-size: 9px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        
        .day-date {
            font-size: 8px;
            color: #ea580c;
            font-weight: 700;
        }
        
        .shift-cell {
            padding: 3px !important;
            background: white;
            vertical-align: top;
            max-width: 0;
            overflow: hidden;
        }
        
        .workers-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 2px;
            width: 100%;
            max-width: 100%;
        }
        
        .worker-item {
            padding: 2px 3px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-left: 2px solid #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 18px;
            font-size: 7px;
            transition: all 0.2s ease;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-width: 100%;
        }
        
        .worker-item.cuc {
            border-left-color: #f97316;
            background: #fff7ed;
        }
        
        .worker-item.pizz {
            border-left-color: #ef4444;
            background: #fff1f2;
        }
        
        .worker-item.fatt {
            border-left-color: #3b82f6;
            background: #f0f9ff;
        }
        
        .worker-item.sala {
            border-left-color: #22c55e;
            background: #f0fdf4;
        }
        
        .worker-name {
            font-weight: 600;
            color: #0f172a;
            font-size: 7px;
            flex-shrink: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .worker-time {
            font-weight: 700;
            color: #ea580c;
            font-size: 7px;
            background: #fff7ed;
            padding: 1px 3px;
            border-radius: 2px;
            flex-shrink: 0;
            white-space: nowrap;
        }
        
        .legend {
            margin-top: 8px;
            padding: 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }
        
        .legend-title {
            font-size: 9px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 5px;
            text-align: center;
        }
        
        .legend-items {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            justify-content: center;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 3px 6px;
            background: white;
            border-radius: 3px;
            border: 1px solid #e2e8f0;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 2px;
            border-left: 2px solid;
        }
        
        .legend-color.cuc {
            border-left-color: #f97316;
            background: #fff7ed;
        }
        
        .legend-color.pizz {
            border-left-color: #ef4444;
            background: #fff1f2;
        }
        
        .legend-color.fatt {
            border-left-color: #3b82f6;
            background: #f0f9ff;
        }
        
        .legend-color.sala {
            border-left-color: #22c55e;
            background: #f0fdf4;
        }
        
        .legend-label {
            font-size: 8px;
            font-weight: 700;
            color: #0f172a;
        }

        .closed-cell {
            background: #fef2f2;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px;
            border: 2px dashed #fca5a5;
            min-height: 35px;
            border-radius: 3px;
        }

        .closed-text {
            color: #dc2626;
            font-weight: 900;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .empty-shift {
            color: #999;
            padding: 6px;
            text-align: center;
            font-size: 8px;
            font-style: italic;
        }

        .footer {
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 8px;
            color: #64748b;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>
                <span class="pizza-icon">🍕</span>
                PIANO DI LAVORO SETTIMANALE
            </h1>
            <div class="subtitle">
                ${(() => {
                  const startDay = format(weekStart, 'EEEE', { locale: it })
                  const startDate = format(weekStart, 'd', { locale: it })
                  const startMonth = format(weekStart, 'MMMM', { locale: it })
                  const endDay = format(weekEnd, 'EEEE', { locale: it })
                  const endDate = format(weekEnd, 'd', { locale: it })
                  const endMonth = format(weekEnd, 'MMMM', { locale: it })
                  const endYear = format(weekEnd, 'yyyy', { locale: it })
                  return `Dal ${startDay} ${startDate} ${startMonth} al ${endDay} ${endDate} ${endMonth} ${endYear}`
                })()}
            </div>
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
                ${daysUpper.map((dayName, dayIndex) => {
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
                        <div class="day-date">${format(dayDate, 'dd/MM')}</div>
                    </td>
                    <td class="shift-cell">
                        ${isPranzoHoliday ? `
                        <div class="closed-cell">
                            <span class="closed-text">CHIUSO</span>
                        </div>
                        ` : pranzoShifts.length > 0 ? `
                        <div class="workers-grid">
                            ${pranzoShifts.map(shift => {
                              const roleCode = getRoleCode(shift.role).toLowerCase()
                              return `
                            <div class="worker-item ${roleCode}">
                                <span class="worker-name">${shift.user.username}</span>
                                <span class="worker-time">${shift.startTime}</span>
                            </div>
                            `
                            }).join('')}
                        </div>
                        ` : `
                        <div class="empty-shift">-</div>
                        `}
                    </td>
                    <td class="shift-cell">
                        ${isCenaHoliday ? `
                        <div class="closed-cell">
                            <span class="closed-text">CHIUSO</span>
                        </div>
                        ` : cenaShifts.length > 0 ? `
                        <div class="workers-grid">
                            ${cenaShifts.map(shift => {
                              const roleCode = getRoleCode(shift.role).toLowerCase()
                              return `
                            <div class="worker-item ${roleCode}">
                                <span class="worker-name">${shift.user.username}</span>
                                <span class="worker-time">${shift.startTime}</span>
                            </div>
                            `
                            }).join('')}
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

        <div class="legend">
            <div class="legend-title">Legenda Ruoli</div>
            <div class="legend-items">
                <div class="legend-item">
                    <div class="legend-color cuc"></div>
                    <span class="legend-label">Cucina</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color pizz"></div>
                    <span class="legend-label">Pizzaiolo</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color fatt"></div>
                    <span class="legend-label">Fattorino</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color sala"></div>
                    <span class="legend-label">Sala</span>
                </div>
            </div>
        </div>

        <div class="footer">
            Piano di lavoro generato il ${format(generationDate, 'dd/MM/yyyy', { locale: it })} alle ${format(generationDate, 'HH:mm', { locale: it })} • Turni: ${totalShifts} • Dipendenti: ${totalEmployees}
        </div>
    </div>
</body>
</html>
  `
}
