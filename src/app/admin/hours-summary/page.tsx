'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { BarChart3, User, Calendar, Clock, ChevronDown, ChevronRight, FileText, AlertCircle, TrendingUp, Users, Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { Role, ShiftType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Select as ReactSelect } from '@/components/ui/react-select'
import { useHaptics } from '@/hooks/use-haptics'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

interface MissingHoursShift {
  shiftId: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  weekStart: string
  shiftDate: string
  hoursStatus: 'REJECTED' | null
}

interface MissingHoursUser {
  userId: string
  username: string
  primaryRole: Role
  shifts: MissingHoursShift[]
}

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
  
  // Stati per "Ore Mancanti"
  const [activeTab, setActiveTab] = useState<'summary' | 'missing'>('summary')
  const [missingHours, setMissingHours] = useState<MissingHoursUser[]>([])
  const [loadingMissing, setLoadingMissing] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [selectedUserId, selectedYear, selectedMonth])

  useEffect(() => {
    if (activeTab === 'missing') {
      fetchMissingHours()
    }
  }, [activeTab])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setAllUsers(data.filter((user: {roles?: string[]}) => !user.roles?.includes('ADMIN')))
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

      const response = await fetch(url)
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

  const fetchMissingHours = async () => {
    setLoadingMissing(true)
    try {
      const response = await fetch(`/api/admin/hours-summary/missing`)
      if (response.ok) {
        const data = await response.json()
        setMissingHours(data.missingHours)
      }
    } catch (error) {
      console.error('Error fetching missing hours:', error)
    } finally {
      setLoadingMissing(false)
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
        credentials: 'include'
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
        credentials: 'include'
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
        credentials: 'include'
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
    { value: null, label: 'Tutto l\'anno' },
    ...Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(0, i).toLocaleDateString('it-IT', { month: 'long' })
    }))
  ]

  const totalHoursAllUsers = summary.reduce((sum, user) => sum + user.yearlyTotal, 0)

  const { lightClick, success: successClick } = useHaptics()

  return (
    <MainLayout adminOnly>
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        {/* Header Premium */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-100 transform -rotate-3">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
                  Analisi & Riepilogo Ore
                </h1>
                <p className="text-gray-500 mt-2 text-sm font-medium">
                  Monitora le ore lavorate, esporta report e gestisci le mancanze.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {activeTab === 'summary' && (
                <button
                  onClick={() => {
                    lightClick()
                    exportToPDF()
                  }}
                  className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Download className="h-4 w-4 text-blue-600" />
                  Esporta PDF Generale
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="bg-gray-100/50 p-2 rounded-[2rem] flex gap-2 border border-gray-200/20">
          <button
            onClick={() => {
              lightClick()
              setActiveTab('summary')
            }}
            className={cn(
              "flex-1 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all duration-300",
              activeTab === 'summary' 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            📊 Riepilogo Mensile/Annuale
          </button>
          <button
            onClick={() => {
              lightClick()
              setActiveTab('missing')
            }}
            className={cn(
              "flex-1 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all duration-300 relative",
              activeTab === 'missing' 
                ? "bg-white text-red-600 shadow-sm" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            ⚠️ Ore Mancanti
            {missingHours.length > 0 && (
              <span className="absolute top-3 right-4 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px]">
                {missingHours.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content: Summary */}
        {activeTab === 'summary' && (
          <div className="space-y-8">
            {/* Filters & Stats Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-soft border border-gray-100 p-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                      value: selectedMonth,
                      label: selectedMonth 
                        ? new Date(0, selectedMonth - 1).toLocaleDateString('it-IT', { month: 'long' })
                        : 'Tutto l\'anno'
                    }}
                    onChange={(option) => {
                      lightClick()
                      setSelectedMonth(option?.value as number | null)
                    }}
                  />
                </div>
              </div>

              {/* Total Hours Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 shadow-xl shadow-blue-100 text-white flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-2">Ore Totali Periodo</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black leading-none">{totalHoursAllUsers.toFixed(1)}</span>
                  <span className="text-sm font-bold opacity-70 mb-1">Ore</span>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest">{summary.length} Dipendenti</p>
                </div>
              </div>
            </div>

            {/* User List */}
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <TableSkeleton cols={4} rows={3} />
                  <TableSkeleton cols={4} rows={3} />
                </div>
              ) : summary.length === 0 ? (
                <div className="bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100 py-20 text-center">
                  <BarChart3 className="h-16 w-16 text-gray-200 mx-auto mb-6" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Nessun dato trovato per questo periodo</p>
                </div>
              ) : (
                summary.map((userSummary) => (
                  <div key={userSummary.user.id} className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden group/user transition-all duration-300">
                    {/* User Header */}
                    <div 
                      className={cn(
                        "p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 cursor-pointer transition-all duration-300",
                        expandedUsers.has(userSummary.user.id) ? "bg-blue-50/30" : "hover:bg-gray-50/50"
                      )}
                      onClick={() => {
                        lightClick()
                        toggleUserExpand(userSummary.user.id)
                      }}
                    >
                      <div className="flex items-center gap-6">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md",
                          expandedUsers.has(userSummary.user.id) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400 group-hover/user:bg-blue-100 group-hover/user:text-blue-600"
                        )}>
                          <User className="h-7 w-7" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-gray-900 leading-none">{userSummary.user.username}</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">
                            {userSummary.user.primaryRole ? getRoleName(userSummary.user.primaryRole) : 'Collaboratore'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 self-end sm:self-auto">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Totale Ore</p>
                          <p className="text-2xl font-black text-gray-900 leading-none">{userSummary.yearlyTotal.toFixed(1)}h</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            lightClick()
                            exportUserYearPDF(userSummary.user.id)
                          }}
                          className="w-10 h-10 rounded-xl bg-white border border-gray-100 text-gray-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                          title="Esporta PDF Annuale"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                        <div className={cn(
                          "w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 transition-all duration-300",
                          expandedUsers.has(userSummary.user.id) && "bg-blue-100 text-blue-600 rotate-180"
                        )}>
                          <ChevronDown className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    {/* Breakdown List */}
                    {expandedUsers.has(userSummary.user.id) && (
                      <div className="px-8 pb-8 space-y-4">
                        <div className="h-px bg-gray-100 w-full mb-6" />
                        
                        {userSummary.monthlyHours.length === 0 ? (
                          <p className="text-center py-8 text-xs font-bold text-gray-400 uppercase tracking-widest">Nessun dato mensile disponibile</p>
                        ) : (
                          userSummary.monthlyHours.map((month) => {
                            const monthKey = `${userSummary.user.id}-${month.month}`
                            const isMonthExpanded = expandedMonths.has(monthKey)

                            return (
                              <div key={month.month} className="bg-gray-50/50 rounded-3xl border border-gray-100 overflow-hidden">
                                <div 
                                  className={cn(
                                    "p-5 flex items-center justify-between cursor-pointer transition-all",
                                    isMonthExpanded ? "bg-white border-b border-gray-100 shadow-sm" : "hover:bg-white/80"
                                  )}
                                  onClick={() => {
                                    lightClick()
                                    toggleMonthExpand(monthKey)
                                  }}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className={cn(
                                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                                      isMonthExpanded ? "bg-blue-600 text-white shadow-lg shadow-blue-50" : "bg-white text-blue-400 shadow-sm"
                                    )}>
                                      <Calendar className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-black text-gray-900 uppercase tracking-tight">{getMonthName(month.month)}</span>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Ore / Turni</p>
                                      <p className="text-sm font-black text-gray-900">{month.totalHours.toFixed(1)}h <span className="text-gray-300 font-medium">/</span> {month.shiftsCount}</p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        lightClick()
                                        exportUserMonthPDF(userSummary.user.id, month.month)
                                      }}
                                      className="p-2 bg-white text-gray-400 rounded-lg border border-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-all"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                {isMonthExpanded && (
                                  <div className="p-4 bg-white/50 space-y-2">
                                    {month.details.map((detail) => {
                                      const weekStartDate = new Date(detail.shift.schedules.weekStart)
                                      const shiftDate = new Date(Date.UTC(
                                        weekStartDate.getUTCFullYear(),
                                        weekStartDate.getUTCMonth(),
                                        weekStartDate.getUTCDate() + detail.shift.dayOfWeek
                                      ))
                                      
                                      return (
                                        <div key={detail.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:border-blue-100 transition-all shadow-sm">
                                          <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex flex-col items-center justify-center font-black text-gray-400 border border-gray-100">
                                              <span className="text-[8px] uppercase leading-none">{getDayName(detail.shift.dayOfWeek).substring(0, 3)}</span>
                                              <span className="text-sm leading-none mt-1">{format(shiftDate, 'd')}</span>
                                            </div>
                                            <div>
                                              <p className="text-xs font-black text-gray-900 uppercase tracking-tight">{getShiftTypeName(detail.shift.shiftType)}</p>
                                              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">{getRoleName(detail.shift.role)}</p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs font-black text-gray-900">{detail.startTime} - {detail.endTime}</p>
                                            <p className="text-[10px] font-bold text-blue-600 mt-1">{detail.totalHours.toFixed(1)}h</p>
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
        )}

        {/* Tab Content: Missing Hours */}
        {activeTab === 'missing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-red-100">
                  <AlertCircle className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Turni senza ore</h2>
                  <p className="text-gray-500 mt-1 text-sm font-medium">Questi collaboratori non hanno ancora inviato le ore per i turni passati.</p>
                </div>
              </div>
              <div className="bg-red-50 px-6 py-3 rounded-2xl border border-red-100">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Collaboratori</p>
                <p className="text-2xl font-black text-red-700 leading-none">{missingHours.length}</p>
              </div>
            </div>

            {loadingMissing ? (
              <div className="space-y-4">
                <TableSkeleton cols={1} rows={4} />
              </div>
            ) : missingHours.length === 0 ? (
              <div className="bg-green-50 rounded-[3rem] border-2 border-dashed border-green-100 py-20 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Clock className="h-10 w-10 text-green-400" />
                </div>
                <h3 className="text-green-600 font-black uppercase tracking-[0.2em] text-sm">Ottimo! Non ci sono ore mancanti.</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {missingHours.map((userMissing) => (
                  <div key={userMissing.userId} className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden group/missing transition-all duration-300">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-md">
                          <User className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-gray-900 leading-tight">{userMissing.username}</h3>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{getRoleName(userMissing.primaryRole)}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-xl text-xs font-black">
                        {userMissing.shifts.length} Turni
                      </span>
                    </div>
                    <div className="p-6 space-y-3">
                      {userMissing.shifts.map((shift) => (
                        <div key={shift.shiftId} className={cn(
                          "p-4 rounded-2xl border transition-all",
                          shift.hoursStatus === 'REJECTED' ? "bg-red-50 border-red-200 shadow-sm" : "bg-white border-gray-100"
                        )}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-xs font-black text-gray-900 uppercase tracking-tight">
                                {getDayName(shift.dayOfWeek)} {format(parseISO(shift.shiftDate), 'dd/MM')}
                              </span>
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{getShiftTypeName(shift.shiftType)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded-lg">{getRoleName(shift.role)}</span>
                            {shift.hoursStatus === 'REJECTED' && (
                              <span className="px-2 py-1 bg-red-600 text-white text-[8px] font-black uppercase rounded-lg animate-pulse">Rifiutato</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
