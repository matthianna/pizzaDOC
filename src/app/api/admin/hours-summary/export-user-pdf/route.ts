import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { shiftCalendarDateUtc, utcCalendarDateKey, formatDate, getDayOfWeek } from '@/lib/date-utils'
import { getDayName } from '@/lib/utils'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'
import {
  PDF_BRAND,
  PDF_COLORS,
  pdfBaseStyles,
  pdfDocHeader,
  pdfDocFooter,
  escapePdfHtml,
} from '@/lib/pdf-fornace-styles'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const roles = session.user.roles
    if (!Array.isArray(roles) || !roles.includes('ADMIN')) {
      return Response.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10)
    const monthRaw = searchParams.get('month')
    let monthFilter: number | null = null
    if (monthRaw !== null && monthRaw !== '') {
      const m = parseInt(monthRaw, 10)
      if (Number.isFinite(m) && m >= 1 && m <= 12) {
        monthFilter = m
      }
    }

    if (!userId) {
      return Response.json({ error: 'userId è richiesto' }, { status: 400 })
    }

    // Ottieni dati utente
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_roles: true
      }
    })

    if (!user) {
      return Response.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    // Ottieni ore lavorate (filtreremo per data effettiva del turno dopo)
    const allWorkedHours = await prisma.worked_hours.findMany({
      where: {
        userId: userId,
        status: 'APPROVED'
      },
      include: {
        shifts: {
          include: {
            schedules: true
          }
        }
      },
      orderBy: {
        submittedAt: 'asc'
      }
    })

    // ✅ Filtra in base alla data EFFETTIVA del turno (non submittedAt)
    const workedHours = allWorkedHours.filter((wh) => {
      const shiftDate = shiftCalendarDateUtc(wh.shifts.schedules.weekStart, wh.shifts.dayOfWeek)
      const shiftYear = shiftDate.getUTCFullYear()
      const shiftMonth = shiftDate.getUTCMonth() + 1
      if (shiftYear !== year) return false
      if (monthFilter !== null && shiftMonth !== monthFilter) return false
      return true
    })

    // Genera HTML del PDF
    const html = generatePDFHtml(user, workedHours, year, monthFilter ?? undefined)

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Errore nell\'export PDF:', error)
    return Response.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

function generatePDFHtml(
  user: {
    id: string;
    username: string;
    primaryRole: string;
    user_roles: Array<{role: string}>;
    isActive: boolean;
  }, 
  workedHours: Array<{
    id: string;
    startTime: string;
    endTime: string;
    totalHours: number;
    status: string;
    submittedAt: Date;
    shifts: {
      dayOfWeek: number;
      shiftType: string;
      role: string;
      schedules: {
        weekStart: Date;
      };
    };
  }>, 
  year: number, 
  month?: number
): string {
  const periodName = month 
    ? format(new Date(year, month - 1), 'MMMM yyyy', { locale: it })
    : `Anno ${year}`
  const totalHours = workedHours.reduce((sum, wh) => sum + wh.totalHours, 0)

  // Raggruppa per settimana
  const weeklyData = workedHours.reduce((acc, wh) => {
    const weekKey = utcCalendarDateKey(wh.shifts.schedules.weekStart)
    if (!acc[weekKey]) {
      acc[weekKey] = {
        weekStart: wh.shifts.schedules.weekStart,
        shifts: []
      }
    }
    acc[weekKey].shifts.push(wh)
    return acc
  }, {} as Record<string, { 
    weekStart: Date; 
    shifts: Array<{
      id: string;
      startTime: string;
      endTime: string;
      totalHours: number;
      status: string;
      submittedAt: Date;
      shifts: {
        dayOfWeek: number;
        shiftType: string;
        role: string;
      };
    }> 
  }>)

  const weeks = Object.values(weeklyData).sort((a, b) => 
    new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  )
  
  // ✅ Ordina i turni dentro ogni settimana cronologicamente
  weeks.forEach(week => {
    week.shifts.sort((a, b) => {
      const shiftDateA = shiftCalendarDateUtc(a.shifts.schedules.weekStart, a.shifts.dayOfWeek)
      const shiftDateB = shiftCalendarDateUtc(b.shifts.schedules.weekStart, b.shifts.dayOfWeek)

      if (shiftDateA.getTime() !== shiftDateB.getTime()) {
        return shiftDateA.getTime() - shiftDateB.getTime()
      }
      
      // Se stessa data, ordina per tipo turno (PRANZO prima di CENA)
      if (a.shifts.shiftType !== b.shifts.shiftType) {
        return a.shifts.shiftType === 'PRANZO' ? -1 : 1
      }
      
      return 0
    })
  })

  const c = PDF_COLORS

  return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Riepilogo ore — ${escapePdfHtml(user.username)} — ${escapePdfHtml(periodName)} — ${PDF_BRAND}</title>
    <style>
        ${pdfBaseStyles(`
        body { padding: 8px; font-size: 11px; }
        .employee-section {
            background: ${c.surfaceMuted};
            border: 1px solid ${c.border};
            border-radius: 10px;
            padding: 14px 16px;
            margin-bottom: 18px;
        }
        .employee-section h3 {
            font-size: 11px;
            font-weight: 600;
            color: ${c.muted};
            margin-bottom: 10px;
        }
        .employee-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
        }
        .employee-item label {
            display: block;
            font-size: 9px;
            font-weight: 600;
            color: ${c.muted};
            margin-bottom: 2px;
        }
        .employee-item span {
            font-size: 12px;
            font-weight: 500;
            color: ${c.text};
        }
        .summary-grid { display: flex; gap: 10px; margin-bottom: 18px; }
        .summary-card {
            flex: 1;
            border: 1px solid ${c.border};
            border-radius: 10px;
            padding: 12px 14px;
            text-align: center;
            background: ${c.surface};
        }
        .summary-card.total {
            border-color: ${c.accent};
            background: ${c.accentSoft};
        }
        .summary-card h4 {
            font-size: 9px;
            font-weight: 600;
            color: ${c.muted};
            margin-bottom: 4px;
        }
        .summary-card .value {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 20px;
            font-weight: 600;
            color: ${c.accent};
        }
        .details-section > h3 {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 15px;
            font-weight: 600;
            color: ${c.text};
            margin-bottom: 12px;
        }
        .week-block {
            margin-bottom: 14px;
            break-inside: avoid;
            border: 1px solid ${c.border};
            border-radius: 10px;
            overflow: hidden;
        }
        .week-header {
            background: ${c.surfaceMuted};
            color: ${c.text};
            padding: 8px 12px;
            font-size: 11px;
            font-weight: 600;
            border-bottom: 1px solid ${c.border};
        }
        .week-table {
            width: 100%;
            border-collapse: collapse;
            background: ${c.surface};
        }
        .week-table th {
            background: ${c.surface};
            padding: 8px 10px;
            font-size: 9px;
            font-weight: 600;
            color: ${c.muted};
            text-align: left;
            border-bottom: 1px solid ${c.border};
        }
        .week-table td {
            padding: 8px 10px;
            font-size: 11px;
            color: ${c.text};
            border-bottom: 1px solid ${c.border};
        }
        .week-table tr:last-child td { border-bottom: none; }
        .no-data {
            text-align: center;
            padding: 36px 16px;
            color: ${c.muted};
        }
        `)}
    </style>
</head>
<body>
    ${pdfDocHeader({
      title: 'Riepilogo ore lavorate',
      subtitle: periodName,
      lines: [`Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}`],
    })}

    <div class="employee-section">
        <h3>Dipendente</h3>
        <div class="employee-grid">
            <div class="employee-item">
                <label>Nome utente</label>
                <span>${escapePdfHtml(user.username)}</span>
            </div>
            <div class="employee-item">
                <label>Ruoli</label>
                <span>${escapePdfHtml(user.user_roles.map((ur: {role: string}) => {
                  const roleNames: Record<string, string> = {
                    'ADMIN': 'Amministratore',
                    'FATTORINO': 'Fattorino',
                    'CUCINA': 'Cucina',
                    'SALA': 'Sala',
                    'PIZZAIOLO': 'Pizzaiolo',
                  }
                  return roleNames[ur.role] || ur.role
                }).join(', '))}</span>
            </div>
            <div class="employee-item">
                <label>Periodo</label>
                <span>${escapePdfHtml(periodName)}</span>
            </div>
            <div class="employee-item">
                <label>Stato</label>
                <span>${user.isActive ? 'Attivo' : 'Inattivo'}</span>
            </div>
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card total">
            <h4>Ore totali</h4>
            <div class="value">${formatDecimalHoursIt(totalHours)}</div>
        </div>
    </div>

    <div class="details-section">
        <h3>Dettaglio turni</h3>

        ${weeks.length === 0 ? `
            <div class="no-data">
                Nessun turno lavorato nel periodo ${escapePdfHtml(periodName)}
            </div>
        ` : weeks.map(week => `
            <div class="week-block">
                <div class="week-header">
                    Settimana del ${escapePdfHtml(format(week.weekStart, 'dd MMMM yyyy', { locale: it }))}
                </div>
                <table class="week-table">
                    <thead>
                        <tr>
                            <th>Giorno</th>
                            <th>Turno</th>
                            <th>Ruolo</th>
                            <th>Orario</th>
                            <th>Ore</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${week.shifts.map(shift => {
                          const shiftDate = shiftCalendarDateUtc(
                            shift.shifts.schedules.weekStart,
                            shift.shifts.dayOfWeek
                          )
                          const giornoTurno = `${getDayName(getDayOfWeek(shiftDate))} ${formatDate(shiftDate)}`
                          const roleNames: Record<string, string> = {
                            'ADMIN': 'Admin',
                            'FATTORINO': 'Fattorino',
                            'CUCINA': 'Cucina',
                            'SALA': 'Sala',
                            'PIZZAIOLO': 'Pizzaiolo'
                          }
                          return `
                            <tr>
                                <td>${escapePdfHtml(giornoTurno)}</td>
                                <td>${shift.shifts.shiftType === 'PRANZO' ? 'Pranzo' : 'Cena'}</td>
                                <td>${escapePdfHtml(roleNames[shift.shifts.role] || shift.shifts.role)}</td>
                                <td>${escapePdfHtml(shift.startTime)} – ${escapePdfHtml(shift.endTime)}</td>
                                <td>${formatDecimalHoursIt(shift.totalHours)}</td>
                            </tr>
                          `
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `).join('')}
    </div>

    ${pdfDocFooter(`Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}`)}

    <script>
        if (window.opener) {
            window.onload = function() {
                setTimeout(() => { window.print(); }, 500);
            }
        }
    </script>
</body>
</html>`
}
