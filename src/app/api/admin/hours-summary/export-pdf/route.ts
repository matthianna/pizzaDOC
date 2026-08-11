import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { shiftCalendarDateUtc } from '@/lib/date-utils'
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
    
    const roles = session?.user?.roles
    if (!session?.user?.id || !Array.isArray(roles) || !roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    // Get the data (same logic as the summary API)
    const where: {
      status: string;
      userId?: string;
    } = {
      status: 'APPROVED'
    }

    if (userId && userId !== 'ALL') {
      where.userId = userId
    }

    // ⚠️ NON filtriamo per submittedAt perché vogliamo filtrare sulla data EFFETTIVA del turno
    // Il filtro per mese/anno verrà applicato DOPO aver calcolato la data del turno

    const workedHours = await prisma.worked_hours.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        shifts: {
          select: {
            dayOfWeek: true,
            shiftType: true,
            role: true,
            schedules: {
              select: {
                weekStart: true
              }
            }
          }
        }
      },
      orderBy: [
        { user: { username: 'asc' } },
        { submittedAt: 'desc' }
      ]
    })

    // ✅ PRIMA filtra i workedHours per anno/mese basandosi sulla data EFFETTIVA del turno
    const filteredWorkedHours = workedHours.filter((wh) => {
      const shiftDate = shiftCalendarDateUtc(wh.shifts.schedules.weekStart, wh.shifts.dayOfWeek)
      const shiftYear = shiftDate.getUTCFullYear()
      const shiftMonth = shiftDate.getUTCMonth() + 1
      if (shiftYear !== year) return false
      if (month !== null && shiftMonth !== month) return false
      return true
    })

    // Process data into summary
    const summary: Record<string, {
      user: {
        id: string;
        username: string;
        primaryRole: string;
      }
      monthlyHours: Record<string, {
        totalHours: number
        shiftsCount: number
        details: Array<{
          id: string;
          totalHours: number;
          submittedAt: Date;
        }>
      }>
      yearlyTotal: number
    }> = {}

    filteredWorkedHours.forEach((wh) => {
      const userId = wh.user.id

      const shiftDate = shiftCalendarDateUtc(wh.shifts.schedules.weekStart, wh.shifts.dayOfWeek)
      const monthKey = shiftDate.toISOString().slice(0, 7)

      if (!summary[userId]) {
        summary[userId] = {
          user: wh.user,
          monthlyHours: {},
          yearlyTotal: 0
        }
      }

      if (!summary[userId].monthlyHours[monthKey]) {
        summary[userId].monthlyHours[monthKey] = {
          totalHours: 0,
          shiftsCount: 0,
          details: []
        }
      }

      summary[userId].monthlyHours[monthKey].totalHours += wh.totalHours
      summary[userId].monthlyHours[monthKey].shiftsCount += 1
      summary[userId].yearlyTotal += wh.totalHours
    })

    // ✅ Ordina i dettagli (turni) cronologicamente dentro ogni mese
    Object.values(summary).forEach(userSummary => {
      Object.values(userSummary.monthlyHours).forEach((monthData: any) => {
        monthData.details.sort((a: any, b: any) => {
          const shiftDateA = shiftCalendarDateUtc(a.shift.schedules.weekStart, a.shift.dayOfWeek)
          const shiftDateB = shiftCalendarDateUtc(b.shift.schedules.weekStart, b.shift.dayOfWeek)

          if (shiftDateA.getTime() !== shiftDateB.getTime()) {
            return shiftDateA.getTime() - shiftDateB.getTime()
          }
          
          // Se stessa data, ordina per tipo turno (PRANZO prima di CENA)
          if (a.shift.shiftType !== b.shift.shiftType) {
            return a.shift.shiftType === 'PRANZO' ? -1 : 1
          }
          
          return 0
        })
      })
    })

    const htmlContent = generateHoursSummaryHTML(summary, year, month, userId)

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error generating hours summary PDF:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateHoursSummaryHTML(
  summary: Record<string, any>,
  year: number,
  month: number | null,
  userId: string | null
): string {
  const getRoleName = (role: string) => {
    switch (role) {
      case 'CUCINA': return 'Cucina'
      case 'FATTORINO': return 'Fattorino'
      case 'SALA': return 'Sala'
      case 'PIZZAIOLO': return 'Pizzaiolo'
      case 'ADMIN': return 'Admin'
      default: return role
    }
  }

  const getMonthName = (monthStr: string) => {
    const [y, m] = monthStr.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 1)
    return format(date, 'MMMM yyyy', { locale: it })
  }

  const totalHoursAllUsers = Object.values(summary).reduce((sum: number, user) => sum + user.yearlyTotal, 0)
  const totalUsers = Object.keys(summary).length

  const periodText = month
    ? `${format(new Date(year, month - 1), 'MMMM yyyy', { locale: it })}`
    : `Anno ${year}`

  const userText = userId && userId !== 'ALL'
    ? ` · ${Object.values(summary)[0]?.user?.username || 'Dipendente'}`
    : ''

  const c = PDF_COLORS
  const generatedAt = `Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}`

  return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Riepilogo ore — ${escapePdfHtml(periodText)} — ${PDF_BRAND}</title>
    <style>
        ${pdfBaseStyles(`
        body { padding: 8px; font-size: 12px; }
        .months-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            padding: 14px;
        }
        .month-card {
            border: 1px solid ${c.border};
            border-radius: 8px;
            padding: 12px;
            background: ${c.surface};
        }
        .month-name {
            font-weight: 600;
            color: ${c.text};
            margin-bottom: 4px;
            text-transform: capitalize;
        }
        .month-stats { font-size: 11px; color: ${c.muted}; }
        .month-total {
            margin-top: 8px;
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 18px;
            font-weight: 600;
            color: ${c.accent};
        }
        .no-data {
            text-align: center;
            padding: 40px 16px;
            color: ${c.muted};
        }
        .user-role { font-size: 11px; color: ${c.muted}; font-weight: 500; }
        `)}
    </style>
</head>
<body>
    ${pdfDocHeader({
      title: 'Riepilogo ore lavorate',
      subtitle: `${periodText}${userText}`,
    })}

    <div class="stat-strip">
        <div class="cell">
            <div class="pd-display value">${formatDecimalHoursIt(totalHoursAllUsers)}</div>
            <div class="label">Ore totali</div>
        </div>
        <div class="cell">
            <div class="pd-display value">${totalUsers}</div>
            <div class="label">Dipendenti</div>
        </div>
        <div class="cell">
            <div class="pd-display value">${formatDecimalHoursIt(totalUsers > 0 ? totalHoursAllUsers / totalUsers : 0)}</div>
            <div class="label">Media per persona</div>
        </div>
    </div>

    ${Object.keys(summary).length === 0 ? `
        <div class="no-data">
            <p class="pd-display" style="font-size:16px;margin-bottom:6px;">Nessun dato disponibile</p>
            <p>Non ci sono ore lavorate per il periodo selezionato.</p>
        </div>
    ` : Object.values(summary).map((userSummary) => `
        <section class="section-card">
            <div class="section-card-head">
                <div>
                    <h3>${escapePdfHtml(userSummary.user.username)}</h3>
                    <div class="user-role">${userSummary.user.primaryRole ? escapePdfHtml(getRoleName(userSummary.user.primaryRole)) : ''}</div>
                </div>
                <div class="meta">${formatDecimalHoursIt(userSummary.yearlyTotal)}</div>
            </div>
            ${Object.keys(userSummary.monthlyHours).length === 0 ? `
                <div class="section-card-body" style="color:${c.muted};text-align:center;">
                    Nessuna ora lavorata nel periodo
                </div>
            ` : `
                <div class="months-grid">
                    ${Object.entries(userSummary.monthlyHours).sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, monthData]: [string, any]) => `
                        <div class="month-card">
                            <div class="month-name">${escapePdfHtml(getMonthName(monthKey))}</div>
                            <div class="month-stats">${monthData.shiftsCount} turni</div>
                            <div class="month-total">${formatDecimalHoursIt(monthData.totalHours)}</div>
                        </div>
                    `).join('')}
                </div>
            `}
        </section>
    `).join('')}

    ${pdfDocFooter(generatedAt)}
</body>
</html>
  `
}
