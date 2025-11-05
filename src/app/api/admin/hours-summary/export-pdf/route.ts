import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
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
      submittedAt?: {
        gte: Date;
        lte: Date;
      };
    } = {
      status: 'APPROVED'
    }

    if (userId && userId !== 'ALL') {
      where.userId = userId
    }

    const startDate = month 
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1)

    const endDate = month
      ? new Date(year, month, 0, 23, 59, 59)
      : new Date(year, 11, 31, 23, 59, 59)

    where.submittedAt = {
      gte: startDate,
      lte: endDate
    }

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

    workedHours.forEach(wh => {
      const userId = wh.user.id
      
      // ✅ Calcola la data EFFETTIVA del turno usando UTC
      const weekStartDate = new Date(wh.shifts.schedules.weekStart)
      const shiftDate = new Date(Date.UTC(
        weekStartDate.getUTCFullYear(),
        weekStartDate.getUTCMonth(),
        weekStartDate.getUTCDate() + wh.shifts.dayOfWeek
      ))
      const monthKey = shiftDate.toISOString().slice(0, 7) // YYYY-MM format basato sulla DATA DEL TURNO

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
          const weekStartA = new Date(a.shift.schedules.weekStart)
          const shiftDateA = new Date(Date.UTC(
            weekStartA.getUTCFullYear(),
            weekStartA.getUTCMonth(),
            weekStartA.getUTCDate() + a.shift.dayOfWeek
          ))
          
          const weekStartB = new Date(b.shift.schedules.weekStart)
          const shiftDateB = new Date(Date.UTC(
            weekStartB.getUTCFullYear(),
            weekStartB.getUTCMonth(),
            weekStartB.getUTCDate() + b.shift.dayOfWeek
          ))
          
          // Ordina cronologicamente
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
      default: return role
    }
  }

  const getMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return format(date, 'MMMM yyyy', { locale: it })
  }

  const totalHoursAllUsers = Object.values(summary).reduce((sum: number, user) => sum + user.yearlyTotal, 0)
  const totalUsers = Object.keys(summary).length

  const periodText = month 
    ? `${format(new Date(year, month - 1), 'MMMM yyyy', { locale: it })}`
    : `Anno ${year}`

  const userText = userId && userId !== 'ALL' 
    ? ` - ${Object.values(summary)[0]?.user?.username || 'Dipendente'}`
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Riepilogo Ore Lavorate - ${periodText}</title>
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
        
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .stat-card {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        
        .stat-number {
            font-size: 32px;
            font-weight: 700;
            color: #f97316;
            margin: 0 0 8px 0;
        }
        
        .stat-label {
            font-size: 14px;
            color: #6b7280;
            margin: 0;
        }
        
        .user-section {
            margin-bottom: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .user-header {
            background: #f97316;
            color: white;
            padding: 16px 20px;
        }
        
        .user-name {
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 4px 0;
        }
        
        .user-role {
            font-size: 14px;
            opacity: 0.9;
            margin: 0;
        }
        
        .user-total {
            float: right;
            font-size: 24px;
            font-weight: 700;
        }
        
        .months-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        
        .month-card {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
        }
        
        .month-header {
            background: #f3f4f6;
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .month-name {
            font-weight: 600;
            color: #374151;
            margin: 0 0 4px 0;
        }
        
        .month-stats {
            font-size: 12px;
            color: #6b7280;
        }
        
        .month-total {
            font-size: 18px;
            font-weight: 700;
            color: #f97316;
            float: right;
        }
        
        .no-data {
            text-align: center;
            padding: 40px;
            color: #9ca3af;
            font-style: italic;
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
            .months-grid { gap: 15px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">🍕 PizzaDOC - Riepilogo Ore Lavorate</h1>
        <p class="subtitle">${periodText}${userText}</p>
    </div>

    <div class="summary-stats">
        <div class="stat-card">
            <div class="stat-number">${totalHoursAllUsers.toFixed(1)}h</div>
            <div class="stat-label">Ore Totali</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${totalUsers}</div>
            <div class="stat-label">Dipendenti</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${totalUsers > 0 ? (totalHoursAllUsers / totalUsers).toFixed(1) : '0'}h</div>
            <div class="stat-label">Media per Dipendente</div>
        </div>
    </div>

    ${Object.keys(summary).length === 0 ? `
        <div class="no-data">
            <h3>Nessun dato disponibile</h3>
            <p>Non ci sono ore lavorate per il periodo selezionato.</p>
        </div>
    ` : Object.values(summary).map((userSummary) => `
        <div class="user-section">
            <div class="user-header">
                <div class="user-name">${userSummary.user.username}</div>
                <div class="user-role">${userSummary.user.primaryRole ? getRoleName(userSummary.user.primaryRole) : ''}</div>
                <div class="user-total">${userSummary.yearlyTotal.toFixed(1)}h</div>
            </div>
            
            ${Object.keys(userSummary.monthlyHours).length === 0 ? `
                <div style="padding: 20px; text-align: center; color: #9ca3af;">
                    Nessuna ora lavorata nel periodo
                </div>
            ` : `
                <div class="months-grid">
                    ${Object.entries(userSummary.monthlyHours).sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, monthData]: [string, any]) => `
                        <div class="month-card">
                            <div class="month-header">
                                <div class="month-name">${getMonthName(monthKey)}</div>
                                <div class="month-stats">${monthData.shiftsCount} turni lavorati</div>
                                <div class="month-total">${monthData.totalHours.toFixed(1)}h</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `).join('')}

    <div class="footer">
        Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })} • PizzaDOC
    </div>
</body>
</html>
  `
}
