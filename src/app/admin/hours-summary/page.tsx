'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { BarChart3, User, Calendar, Clock, ChevronDown, ChevronRight, FileText, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { Role, ShiftType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Select as ReactSelect } from '@/components/ui/react-select'

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

  return (
    <MainLayout adminOnly>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Moderno */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mr-3">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              Riepilogo Ore Lavorate
            </h1>
            <p className="text-gray-600 mt-1.5">
              Visualizza le ore lavorate per dipendente e monitora le ore mancanti
            </p>
          </div>
          {activeTab === 'summary' && (
            <Button onClick={exportToPDF} variant="outline" className="rounded-xl">
              <FileText className="h-4 w-4 mr-2" />
              Esporta PDF
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                activeTab === 'summary'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span>Riepilogo</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('missing')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                activeTab === 'missing'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-200'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>Ore Mancanti</span>
                {missingHours.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-white text-red-600 rounded-full text-xs font-bold">
                    {missingHours.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Filtri - Solo per tab Riepilogo */}
        {activeTab === 'summary' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <ReactSelect
                label="Dipendente"
                options={[
                  { value: 'ALL', label: 'Tutti i dipendenti' },
                  ...allUsers.map(user => ({
                    value: user.id,
                    label: `${user.username}${user.primaryRole ? ` (${getRoleName(user.primaryRole)})` : ''}`
                  }))
                ]}
                value={{
                  value: selectedUserId,
                  label: selectedUserId === 'ALL' 
                    ? 'Tutti i dipendenti' 
                    : allUsers.find(u => u.id === selectedUserId)?.username || 'Tutti i dipendenti'
                }}
                onChange={(option) => setSelectedUserId(option?.value as string || 'ALL')}
              />

              <ReactSelect
                label="Anno"
                options={currentYearOptions}
                value={{ value: selectedYear, label: selectedYear.toString() }}
                onChange={(option) => setSelectedYear(option?.value as number || new Date().getFullYear())}
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
                onChange={(option) => setSelectedMonth(option?.value as number | null)}
              />

              <div className="flex items-end">
                <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 border border-orange-200/50 rounded-xl px-4 py-3 w-full">
                  <div className="text-sm text-orange-600 font-semibold">Ore Totali</div>
                  <div className="text-2xl font-bold text-orange-700">{totalHoursAllUsers.toFixed(1)}h</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Summary */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white rounded-2xl border border-gray-200/50 p-16 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Caricamento riepilogo...</p>
              </div>
            ) : summary.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl border border-gray-200/50 p-16 text-center">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <BarChart3 className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun dato</h3>
                <p className="text-gray-600">Non ci sono ore lavorate per i filtri selezionati.</p>
              </div>
            ) : (
            summary.map((userSummary) => (
              <div key={userSummary.user.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* User Header */}
                <div 
                  className="p-4 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleUserExpand(userSummary.user.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center">
                        {expandedUsers.has(userSummary.user.id) ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <User className="h-5 w-5 text-orange-500" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{userSummary.user.username}</h3>
                        {userSummary.user.primaryRole && (
                          <p className="text-sm text-gray-500">{getRoleName(userSummary.user.primaryRole)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          exportUserYearPDF(userSummary.user.id)
                        }}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 border border-orange-300 rounded-md hover:bg-orange-200 transition-colors"
                        title="Esporta PDF anno completo"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        PDF Anno
                      </button>
                      <div className="text-right">
                        <div className="text-xl font-bold text-orange-600">
                          {userSummary.yearlyTotal.toFixed(1)}h
                        </div>
                        <div className="text-sm text-gray-500">
                          {selectedMonth ? 'Totale mese' : 'Totale anno'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Breakdown */}
                {expandedUsers.has(userSummary.user.id) && (
                  <div className="p-4 space-y-3">
                    {userSummary.monthlyHours.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Nessuna ora lavorata nel periodo selezionato</p>
                    ) : (
                      userSummary.monthlyHours.map((month) => {
                        const monthKey = `${userSummary.user.id}-${month.month}`
                        return (
                          <div key={month.month} className="border border-gray-200 rounded-lg">
                            {/* Month Header */}
                            <div 
                              className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleMonthExpand(monthKey)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {expandedMonths.has(monthKey) ? (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                  )}
                                  <Calendar className="h-4 w-4 text-blue-500" />
                                  <span className="font-medium text-gray-900">
                                    {getMonthName(month.month)}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      exportUserMonthPDF(userSummary.user.id, month.month)
                                    }}
                                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 transition-colors"
                                    title={`Esporta PDF ${getMonthName(month.month)}`}
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    PDF
                                  </button>
                                  <div className="text-sm text-gray-500">
                                    {month.shiftsCount} turni
                                  </div>
                                  <div className="font-semibold text-blue-600">
                                    {month.totalHours.toFixed(1)}h
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Month Details */}
                            {expandedMonths.has(monthKey) && (
                              <div className="p-3 bg-white">
                                <div className="space-y-2">
                                  {month.details.map((detail) => {
                                    // Calcola la data effettiva del turno
                                    const shiftDate = new Date(detail.shift.schedules.weekStart)
                                    shiftDate.setDate(shiftDate.getDate() + detail.shift.dayOfWeek)
                                    
                                    return (
                                      <div key={detail.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                                        <div className="flex items-center space-x-3">
                                          <Clock className="h-4 w-4 text-gray-400" />
                                          <div>
                                            <div className="text-sm font-medium text-gray-900">
                                              {getDayName(detail.shift.dayOfWeek)} - {getShiftTypeName(detail.shift.shiftType)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              {format(shiftDate, 'dd/MM/yyyy', { locale: it })} • {getRoleName(detail.shift.role)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-medium text-gray-900">
                                            {detail.startTime} - {detail.endTime}
                                          </div>
                                          <div className="text-sm text-green-600 font-medium">
                                            {detail.totalHours.toFixed(1)}h
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
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
        )}

        {/* Tab Content: Ore Mancanti */}
        {activeTab === 'missing' && (
          <div className="space-y-4">
            {loadingMissing ? (
              <div className="bg-white rounded-2xl border border-gray-200/50 p-16 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Caricamento ore mancanti...</p>
              </div>
            ) : missingHours.length === 0 ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50/30 rounded-2xl border border-green-200/50 p-16 text-center">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Clock className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Tutto in ordine!</h3>
                <p className="text-gray-600">Tutti i dipendenti hanno inviato le loro ore per questa settimana.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-red-50 to-orange-50/50 border border-red-200/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div className="text-sm font-semibold text-red-800">
                      {missingHours.length} {missingHours.length === 1 ? 'dipendente ha' : 'dipendenti hanno'} turni senza ore inviate
                    </div>
                  </div>
                </div>

                {missingHours.map((userMissing) => (
                  <div key={userMissing.userId} className="bg-white rounded-2xl border border-gray-200/50 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">{userMissing.username}</h3>
                        <p className="text-sm text-gray-600 font-medium">{getRoleName(userMissing.primaryRole)}</p>
                      </div>
                      <div className="ml-auto">
                        <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-bold">
                          {userMissing.shifts.length} {userMissing.shifts.length === 1 ? 'turno' : 'turni'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {userMissing.shifts.map((shift) => (
                        <div key={shift.shiftId} className={`rounded-xl p-3 ${
                          shift.hoursStatus === 'REJECTED' 
                            ? 'bg-red-50 border-2 border-red-200' 
                            : 'bg-gray-50 border border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span className="font-medium text-gray-900">
                                {getDayName(shift.dayOfWeek)} - {getShiftTypeName(shift.shiftType)}
                              </span>
                              <span className="text-sm text-gray-600">
                                {getRoleName(shift.role)}
                              </span>
                              {shift.hoursStatus === 'REJECTED' && (
                                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-lg">
                                  ORE RIFIUTATE
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 font-medium">
                              {shift.startTime} - {shift.endTime}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <span className="opacity-60">Data turno:</span>
                            <span className="font-medium">{format(parseISO(shift.shiftDate), 'dd/MM/yyyy', { locale: it })}</span>
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
