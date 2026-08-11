'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState } from '@/components/ui/list-row'
import { BarChart3, User, Calendar, Clock, ChevronDown, FileText, Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { Role, ShiftType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Select as ReactSelect } from '@/components/ui/react-select'
import { useHaptics } from '@/hooks/use-haptics'
import { shiftCalendarDateUtc } from '@/lib/date-utils'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

interface User {
  id: string
  username: string
  primaryRole?: Role
}

interface ShiftDetail {
  id: string
  shiftId: string
  startTime: string
  endTime: string
  totalHours: number
  submittedAt: string
  shift: {
    dayOfWeek: number
    shiftType: ShiftType
    role: Role
    schedules: {
      weekStart: string
    }
  }
}

interface MonthlyHours {
  month: string
  totalHours: number
  shiftsCount: number
  details: ShiftDetail[]
}

interface UserSummary {
  user: User
  monthlyHours: MonthlyHours[]
  yearlyTotal: number
}

export default function AdminHoursSummaryPage() {
  const [summary, setSummary] = useState<UserSummary[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [selectedUserId, selectedYear, selectedMonth])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        cache: 'no-store',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data) ? data : (data.users ?? [])
        setAllUsers(list.filter((user: { roles?: string[] }) => !user.roles?.includes('ADMIN')))
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchSummary = async () => {
    setLoading(true)
    try {
      let url = `/api/admin/hours-summary?year=${selectedYear}`
      if (selectedUserId !== 'ALL') {
        url += `&userId=${selectedUserId}`
      }
      if (selectedMonth) {
        url += `&month=${selectedMonth}`
      }

      const response = await fetch(url, {
        cache: 'no-store',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Error fetching summary:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleUserExpand = (userId: string) => {
    const newExpanded = new Set(expandedUsers)
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId)
    } else {
      newExpanded.add(userId)
    }
    setExpandedUsers(newExpanded)
  }

  const toggleMonthExpand = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey)
    } else {
      newExpanded.add(monthKey)
    }
    setExpandedMonths(newExpanded)
  }

  const getMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return format(date, 'MMMM yyyy', { locale: it })
  }

  const exportToPDF = async () => {
    try {
      let url = `/api/admin/hours-summary/export-pdf?year=${selectedYear}`
      if (selectedUserId !== 'ALL') {
        url += `&userId=${selectedUserId}`
      }
      if (selectedMonth) {
        url += `&month=${selectedMonth}`
      }
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })
      
      if (response.ok) {
        const htmlContent = await response.text()
        const newWindow = window.open('', '_blank')
        if (newWindow) {
          newWindow.document.write(htmlContent)
          newWindow.document.close()
          setTimeout(() => {
            newWindow.print()
          }, 500)
        }
      } else {
        console.error('Failed to export PDF:', response.statusText)
        alert('Errore durante l\'esportazione del PDF')
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Errore durante l\'esportazione del PDF')
    }
  }

  const exportUserMonthPDF = async (userId: string, monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-')
      const url = `/api/admin/hours-summary/export-user-pdf?userId=${userId}&year=${year}&month=${month}`
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })
      
      if (response.ok) {
        const htmlContent = await response.text()
        const newWindow = window.open('', '_blank')
        if (newWindow) {
          newWindow.document.write(htmlContent)
          newWindow.document.close()
          setTimeout(() => {
            newWindow.print()
          }, 500)
        }
      } else {
        console.error('Failed to export user PDF:', response.statusText)
        alert('Errore durante l\'esportazione del PDF')
      }
    } catch (error) {
      console.error('Error exporting user PDF:', error)
      alert('Errore durante l\'esportazione del PDF')
    }
  }

  const exportUserYearPDF = async (userId: string) => {
    try {
      const url = `/api/admin/hours-summary/export-user-pdf?userId=${userId}&year=${selectedYear}`
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })
      
      if (response.ok) {
        const htmlContent = await response.text()
        const newWindow = window.open('', '_blank')
        if (newWindow) {
          newWindow.document.write(htmlContent)
          newWindow.document.close()
          setTimeout(() => {
            newWindow.print()
          }, 500)
        }
      } else {
        console.error('Failed to export user year PDF:', response.statusText)
        alert('Errore durante l\'esportazione del PDF')
      }
    } catch (error) {
      console.error('Error exporting user year PDF:', error)
      alert('Errore durante l\'esportazione del PDF')
    }
  }

  const currentYearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - i
    return { value: year, label: year.toString() }
  })

  const monthOptions = [
    { value: 0, label: 'Tutto l\'anno' },
    ...Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(0, i).toLocaleDateString('it-IT', { month: 'long' })
    }))
  ]

  const totalHoursAllUsers = summary.reduce((sum, user) => sum + user.yearlyTotal, 0)

  const { lightClick, success: successClick } = useHaptics()

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <div className="pd-page pb-16">
        <PageHeader
          dense
          title="Riepilogo ore"
          subtitle="Monitora ore lavorate ed esporta report"
          action={
            <button
              type="button"
              onClick={() => {
                lightClick()
                exportToPDF()
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold pd-press"
              style={{
                color: 'var(--pd-text)',
                background: 'var(--pd-surface-muted)',
                borderRadius: 'var(--pd-radius)',
              }}
            >
              <Download className="h-4 w-4" />
              Esporta PDF
            </button>
          }
        />

        <StatStrip
          items={[
            { label: 'Ore totali periodo', value: formatDecimalHoursIt(totalHoursAllUsers) },
            { label: 'Collaboratori', value: summary.length },
          ]}
        />

        <div className="space-y-6">
            {/* Filters & Stats Cards */}
            <SectionBlock card>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ReactSelect
                    label="Filtra Dipendente"
                    options={[
                      { value: 'ALL', label: 'Tutti i dipendenti' },
                      ...allUsers.map(user => ({
                        value: user.id,
                        label: user.username
                      }))
                    ]}
                    value={{
                      value: selectedUserId,
                      label: selectedUserId === 'ALL' 
                        ? 'Tutti i dipendenti' 
                        : allUsers.find(u => u.id === selectedUserId)?.username || 'Tutti i dipendenti'
                    }}
                    onChange={(option) => {
                      lightClick()
                      setSelectedUserId(option?.value as string || 'ALL')
                    }}
                  />

                  <ReactSelect
                    label="Anno"
                    options={currentYearOptions}
                    value={{ value: selectedYear, label: selectedYear.toString() }}
                    onChange={(option) => {
                      lightClick()
                      setSelectedYear(option?.value as number || new Date().getFullYear())
                    }}
                  />

                  <ReactSelect
                    label="Mese"
                    options={monthOptions}
                    value={{
                      value: selectedMonth ?? 0,
                      label: selectedMonth 
                        ? new Date(0, selectedMonth - 1).toLocaleDateString('it-IT', { month: 'long' })
                        : 'Tutto l\'anno'
                    }}
                    onChange={(option) => {
                      lightClick()
                      const v = option?.value as number | undefined
                      setSelectedMonth(!v ? null : v)
                    }}
                  />
                </div>
              </div>
            </SectionBlock>

            {/* User List */}
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <TableSkeleton cols={4} rows={3} />
                  <TableSkeleton cols={4} rows={3} />
                </div>
              ) : summary.length === 0 ? (
                <SectionBlock card>
                  <EmptyState
                    title="Nessun dato trovato per questo periodo"
                    icon={<BarChart3 className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
                  />
                </SectionBlock>
              ) : (
                summary.map((userSummary) => (
                  <div key={userSummary.user.id} className="bg-[var(--pd-surface)] rounded-[var(--pd-radius-lg)] shadow-[var(--pd-shadow)] border border-[var(--pd-border)] overflow-hidden group/user transition-all duration-300">
                    {/* User Header */}
                    <div 
                      className={cn(
                        "p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all duration-300",
                        expandedUsers.has(userSummary.user.id) ? "bg-[var(--pd-accent-soft)]/30" : "hover:bg-[var(--pd-surface-muted)]/80"
                      )}
                      onClick={() => {
                        lightClick()
                        toggleUserExpand(userSummary.user.id)
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                          expandedUsers.has(userSummary.user.id) ? "bg-[var(--pd-accent)] text-[var(--pd-accent-fg)]" : "bg-[var(--pd-surface-muted)] text-[var(--pd-muted)] group-hover/user:bg-[var(--pd-accent-soft)] group-hover/user:text-[var(--pd-accent)]"
                        )}>
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--pd-text)] leading-none">{userSummary.user.username}</h3>
                          <p className="text-[10px] font-bold text-[var(--pd-muted)] mt-1.5">
                            {userSummary.user.primaryRole ? getRoleName(userSummary.user.primaryRole) : 'Collaboratore'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-auto">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-[var(--pd-muted)]  mb-1">Totale Ore</p>
                          <p className="text-xl font-semibold text-[var(--pd-text)] leading-none">{formatDecimalHoursIt(userSummary.yearlyTotal)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            lightClick()
                            exportUserYearPDF(userSummary.user.id)
                          }}
                          className="w-9 h-9 rounded-xl bg-[var(--pd-surface)] border border-[var(--pd-border)] text-[var(--pd-muted)] flex items-center justify-center hover:bg-[var(--pd-accent-soft)] hover:text-[var(--pd-accent)] transition-all"
                          title="Esporta PDF Annuale"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <div className={cn(
                          "w-9 h-9 rounded-xl bg-[var(--pd-surface-muted)] flex items-center justify-center text-[var(--pd-muted)] transition-all duration-300",
                          expandedUsers.has(userSummary.user.id) && "bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] rotate-180"
                        )}>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </div>

                    {/* Breakdown List */}
                    {expandedUsers.has(userSummary.user.id) && (
                      <div className="px-5 pb-5 space-y-3" style={{ borderTop: '1px solid var(--pd-border)' }}>
                        {userSummary.monthlyHours.length === 0 ? (
                          <p className="text-center py-8 text-xs font-bold text-[var(--pd-muted)] mt-3">Nessun dato mensile disponibile</p>
                        ) : (
                          userSummary.monthlyHours.map((month) => {
                            const monthKey = `${userSummary.user.id}-${month.month}`
                            const isMonthExpanded = expandedMonths.has(monthKey)

                            return (
                              <div key={month.month} className="bg-[var(--pd-surface-muted)]/80 rounded-[var(--pd-radius-lg)] border border-[var(--pd-border)] overflow-hidden mt-3">
                                <div 
                                  className={cn(
                                    "p-4 flex items-center justify-between cursor-pointer transition-all",
                                    isMonthExpanded ? "bg-[var(--pd-surface)] border-b border-[var(--pd-border)]" : "hover:bg-[var(--pd-surface)]/80"
                                  )}
                                  onClick={() => {
                                    lightClick()
                                    toggleMonthExpand(monthKey)
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                                      isMonthExpanded ? "bg-[var(--pd-accent)] text-[var(--pd-accent-fg)]" : "bg-[var(--pd-surface)] text-[var(--pd-accent)]"
                                    )}>
                                      <Calendar className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-semibold text-[var(--pd-text)] uppercase tracking-tight">{getMonthName(month.month)}</span>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="text-right hidden sm:block">
                                      <p className="text-[9px] font-semibold text-[var(--pd-muted)]  mb-0.5">Ore / Turni</p>
                                      <p className="text-sm font-semibold text-[var(--pd-text)]">{formatDecimalHoursIt(month.totalHours)} <span className="text-[var(--pd-muted)]/50 font-medium">/</span> {month.shiftsCount}</p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        lightClick()
                                        exportUserMonthPDF(userSummary.user.id, month.month)
                                      }}
                                      className="p-2 bg-[var(--pd-surface)] text-[var(--pd-muted)] rounded-lg border border-[var(--pd-border)] hover:bg-[var(--pd-accent-soft)] hover:text-[var(--pd-accent)] transition-all"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                {isMonthExpanded && (
                                  <div className="p-3 space-y-2">
                                    {month.details.map((detail) => {
                                      const shiftDate = shiftCalendarDateUtc(
                                        detail.shift.schedules.weekStart,
                                        detail.shift.dayOfWeek
                                      )

                                      return (
                                        <div key={detail.id} className="flex items-center justify-between p-3 bg-[var(--pd-surface)] rounded-xl border border-[var(--pd-border)] transition-all">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-[var(--pd-surface-muted)] flex flex-col items-center justify-center font-semibold text-[var(--pd-muted)] border border-[var(--pd-border)]">
                                              <span className="text-xs uppercase leading-none">{getDayName(detail.shift.dayOfWeek).substring(0, 3)}</span>
                                              <span className="text-sm leading-none mt-1">{shiftDate.getUTCDate()}</span>
                                            </div>
                                            <div>
                                              <p className="text-xs font-semibold text-[var(--pd-text)] uppercase tracking-tight">{getShiftTypeName(detail.shift.shiftType)}</p>
                                              <p className="text-[9px] text-[var(--pd-muted)] font-bold  mt-1">{getRoleName(detail.shift.role)}</p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs font-semibold text-[var(--pd-text)]">{detail.startTime} - {detail.endTime}</p>
                                            <p className="text-[10px] font-bold text-[var(--pd-accent)] mt-1">{formatDecimalHoursIt(detail.totalHours)}</p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
        </div>
      </div>
    </MainLayout>
  )
}
