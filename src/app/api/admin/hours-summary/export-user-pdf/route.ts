import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { it } from 'date-fns/locale'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    if (!session.user.roles.includes('ADMIN')) {
      return Response.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    if (!userId) {
      return Response.json({ error: 'userId è richiesto' }, { status: 400 })
    }

    // Ottieni dati utente
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: true
      }
    })

    if (!user) {
      return Response.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    // Calcola range (mese specifico o anno intero)
    const startDate = month ? startOfMonth(new Date(year, month - 1)) : new Date(year, 0, 1)
    const endDate = month ? endOfMonth(new Date(year, month - 1)) : new Date(year, 11, 31)

    // Ottieni ore lavorate del periodo
    const workedHours = await prisma.workedHours.findMany({
      where: {
        userId: userId,
        shift: {
          schedule: {
            weekStart: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      },
      include: {
        shift: {
          include: {
            schedule: true
          }
        }
      },
      orderBy: {
        shift: {
          schedule: {
            weekStart: 'asc'
          }
        }
      }
    })

    // Genera HTML del PDF
    const html = generatePDFHtml(user, workedHours, year, month)

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
  }, 
  workedHours: Array<{
    id: string;
    totalHours: number;
    status: string;
    submittedAt: Date;
    shift: {
      dayOfWeek: number;
      shiftType: string;
      role: string;
      schedule: {
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
    const weekKey = format(wh.shift.schedule.weekStart, 'yyyy-MM-dd')
    if (!acc[weekKey]) {
      acc[weekKey] = {
        weekStart: wh.shift.schedule.weekStart,
        shifts: []
      }
    }
    acc[weekKey].shifts.push(wh)
    return acc
  }, {} as Record<string, { 
    weekStart: Date; 
    shifts: Array<{
      id: string;
      totalHours: number;
      status: string;
      submittedAt: Date;
      shift: {
        dayOfWeek: number;
        shiftType: string;
        role: string;
      };
    }> 
  }>)

  const weeks = Object.values(weeklyData).sort((a, b) => 
    new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  )

  return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Riepilogo Ore - ${user.username} - ${periodName}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #1f2937;
            background: white;
            padding: 20px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f97316;
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .logo {
            width: 50px;
            height: 50px;
            background: #f97316;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            font-weight: bold;
            overflow: hidden;
        }
        
        .logo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 8px;
        }
        
        .company-info h1 {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 4px;
        }
        
        .company-info p {
            font-size: 14px;
            color: #6b7280;
        }
        
        .document-info {
            text-align: right;
        }
        
        .document-info h2 {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
        }
        
        .document-info p {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 4px;
        }
        
        .employee-section {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .employee-section h3 {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 12px;
        }
        
        .employee-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        
        .employee-item {
            display: flex;
            flex-direction: column;
        }
        
        .employee-item label {
            font-size: 11px;
            font-weight: 500;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        
        .employee-item span {
            font-size: 14px;
            font-weight: 500;
            color: #1f2937;
        }
        
        .summary-section {
            margin-bottom: 30px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
        }
        
        .summary-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
        }
        
        .summary-card.total {
            border-color: #f97316;
            background: #fff7ed;
        }
        
        .summary-card.approved {
            border-color: #10b981;
            background: #ecfdf5;
        }
        
        .summary-card.pending {
            border-color: #f59e0b;
            background: #fffbeb;
        }
        
        .summary-card.rejected {
            border-color: #ef4444;
            background: #fef2f2;
        }
        
        .summary-card h4 {
            font-size: 11px;
            font-weight: 500;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        
        .summary-card .value {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 4px;
        }
        
        .summary-card.total .value { color: #ea580c; }
        .summary-card.approved .value { color: #059669; }
        .summary-card.pending .value { color: #d97706; }
        .summary-card.rejected .value { color: #dc2626; }
        
        .summary-card .unit {
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
        }
        
        .details-section h3 {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 20px;
        }
        
        .week-block {
            margin-bottom: 24px;
            break-inside: avoid;
        }
        
        .week-header {
            background: #1f2937;
            color: white;
            padding: 8px 12px;
            border-radius: 6px 6px 0 0;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .week-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border: 1px solid #e2e8f0;
            border-top: none;
            border-radius: 0 0 6px 6px;
        }
        
        .week-table th {
            background: #f8fafc;
            padding: 8px 10px;
            font-size: 10px;
            font-weight: 600;
            color: #374151;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .week-table td {
            padding: 8px 10px;
            font-size: 11px;
            color: #1f2937;
            border-bottom: 1px solid #f1f5f9;
        }
        
        .week-table tr:last-child td {
            border-bottom: none;
        }
        
        .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .status-approved { background: #dcfce7; color: #166534; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-rejected { background: #fee2e2; color: #991b1b; }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 10px;
            color: #6b7280;
        }
        
        .no-data {
            text-align: center;
            padding: 40px 20px;
            color: #6b7280;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-section">
            <div class="logo">
                <img src="/logo.png" alt="PizzaDOC Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                <span style="display: none;">🍕</span>
            </div>
            <div class="company-info">
                <h1>PizzaDOC</h1>
                <p>Sistema di Gestione Piano di Lavoro</p>
            </div>
        </div>
        <div class="document-info">
            <h2>Riepilogo Ore Lavorate</h2>
            <p><strong>Periodo:</strong> ${periodName}</p>
            <p><strong>Generato il:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}</p>
        </div>
    </div>

    <div class="employee-section">
        <h3>Informazioni Dipendente</h3>
        <div class="employee-grid">
            <div class="employee-item">
                <label>Nome Utente</label>
                <span>${user.username}</span>
            </div>
            <div class="employee-item">
                <label>Ruoli</label>
                <span>${user.userRoles.map((ur: {role: string}) => {
                  const roleNames: Record<string, string> = {
                    'ADMIN': 'Amministratore',
                    'FATTORINO': 'Fattorino', 
                    'CUCINA': 'Cucina',
                    'SALA': 'Sala'
                  }
                  return roleNames[ur.role] || ur.role
                }).join(', ')}</span>
            </div>
            <div class="employee-item">
                <label>Periodo</label>
                <span>${periodName}</span>
            </div>
            <div class="employee-item">
                <label>Stato</label>
                <span>${user.isActive ? 'Attivo' : 'Inattivo'}</span>
            </div>
        </div>
    </div>

    <div class="summary-section">
        <div class="summary-grid">
            <div class="summary-card total">
                <h4>Ore Totali</h4>
                <div class="value">${totalHours.toFixed(1)}</div>
                <div class="unit">ore</div>
            </div>
        </div>
    </div>

    <div class="details-section">
        <h3>Dettaglio Turni</h3>
        
        ${weeks.length === 0 ? `
            <div class="no-data">
                Nessun turno lavorato nel periodo ${periodName}
            </div>
        ` : weeks.map(week => `
            <div class="week-block">
                <div class="week-header">
                    Settimana del ${format(week.weekStart, 'dd MMMM yyyy', { locale: it })}
                </div>
                <table class="week-table">
                    <thead>
                        <tr>
                            <th>Giorno</th>
                            <th>Turno</th>
                            <th>Ruolo</th>
                            <th>Orario</th>
                            <th>Ore</th>
                            <th>Stato</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${week.shifts.map(shift => {
                          const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
                          const statusLabels: Record<string, string> = {
                            'APPROVED': 'Approvato',
                            'PENDING': 'In Attesa',
                            'REJECTED': 'Rifiutato'
                          }
                          const roleNames: Record<string, string> = {
                            'ADMIN': 'Admin',
                            'FATTORINO': 'Fattorino',
                            'CUCINA': 'Cucina', 
                            'SALA': 'Sala'
                          }
                          return `
                            <tr>
                                <td>${dayNames[shift.shift.dayOfWeek]}</td>
                                <td>${shift.shift.shiftType === 'PRANZO' ? 'Pranzo' : 'Cena'}</td>
                                <td>${roleNames[shift.shift.role] || shift.shift.role}</td>
                                <td>${shift.startTime} - ${shift.endTime}</td>
                                <td>${shift.totalHours.toFixed(1)}h</td>
                                <td><span class="status-badge status-${shift.status.toLowerCase()}">${statusLabels[shift.status] || shift.status}</span></td>
                            </tr>
                          `
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `).join('')}
    </div>

    <div class="footer">
        <p>Documento generato automaticamente da PizzaDOC - Sistema di Gestione Piano di Lavoro</p>
        <p>© ${new Date().getFullYear()} PizzaDOC. Tutti i diritti riservati.</p>
    </div>

    <script>
        // Auto-print quando aperto in nuova finestra
        if (window.opener) {
            window.onload = function() {
                setTimeout(() => {
                    window.print();
                }, 500);
            }
        }
    </script>
</body>
</html>`
}
