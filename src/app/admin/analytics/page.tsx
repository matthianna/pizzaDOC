'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { BarChart3, TrendingUp, Users, Clock, Calendar, AlertTriangle, Award, DollarSign, Percent, ChevronDown, ChevronUp } from 'lucide-react'
import { format, addWeeks, subWeeks, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { getWeekStart } from '@/lib/date-utils'

interface AnalyticsData {
  // Statistiche generali
  totalShifts: number
  totalWorkers: number
  totalHoursWorked: number
  avgShiftsPerWorker: number
  
  // Ore lavorate per utente
  userHoursStats: {
    userId: string
    username: string
    totalHours: number
    totalShifts: number
    avgHoursPerShift: number
    pendingHours: number
    approvedHours: number
    rejectedHours: number
  }[]
  
  // Distribuzione per ruolo
  roleDistribution: {
    role: string
    totalShifts: number
    totalHours: number
    percentage: number
  }[]
  
  // Distribuzione per giorno
  dayDistribution: {
    day: string
    dayOfWeek: number
    totalShifts: number
    totalWorkers: number
    avgWorkersPerShift: number
  }[]
  
  // Distribuzione per tipo turno
  shiftTypeDistribution: {
    shiftType: string
    totalShifts: number
    percentage: number
  }[]
  
  // Sostituzioni
  substitutionStats: {
    totalRequests: number
    pending: number
    approved: number
    rejected: number
    avgResponseTime: number
  }
  
  // Copertura turni
  coverageStats: {
    totalRequiredSlots: number
    totalFilledSlots: number
    coveragePercentage: number
    gaps: {
      day: string
      shiftType: string
      role: string
      missing: number
    }[]
  }
  
  // Trasporti
  transportStats: {
    scooter: number
    auto: number
    bicicletta: number
    piedi: number
  }
  
  // Top performers
  topPerformers: {
    username: string
    totalShifts: number
    totalHours: number
    reliability: number
  }[]
  
  // Assenze
  absenceStats: {
    totalAbsences: number
    activeAbsences: number
    avgAbsenceDuration: number
    topAbsences: {
      username: string
      totalDays: number
      absenceCount: number
    }[]
  }
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => {
    return getWeekStart(new Date())
  })
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: true,
    users: true,
    roles: true,
    days: true,
    coverage: false,
    substitutions: false,
    transports: false,
    performers: false,
    absences: false
  })

  useEffect(() => {
    fetchAnalytics()
  }, [weekStart])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const formattedWeekStart = format(weekStart, 'yyyy-MM-dd')
      const response = await fetch(`/api/admin/analytics?weekStart=${formattedWeekStart}`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Caricamento analytics...</div>
        </div>
      </MainLayout>
    )
  }

  if (!analytics) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Nessun dato disponibile</div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header Moderno */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              Analytics
            </h1>
            <p className="text-gray-600 mt-2 ml-16">
              Analisi dettagliate e statistiche del periodo
            </p>
          </div>
          
          {/* Week Selector Moderno */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(subWeeks(weekStart, 1))}
              className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all font-medium text-gray-700 hover:text-blue-700"
            >
              ← Prec.
            </button>
            <div className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white font-bold shadow-lg min-w-[180px] text-center">
              {format(weekStart, 'dd MMM yyyy', { locale: it })}
            </div>
            <button
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all font-medium text-gray-700 hover:text-blue-700"
            >
              Succ. →
            </button>
          </div>
        </div>

        {/* KPI Cards Moderne */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group bg-white rounded-2xl p-6 border-2 border-blue-100 hover:border-blue-300 transition-all hover:shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Calendar className="h-7 w-7 text-white" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">Turni Totali</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.totalShifts}</p>
          </div>

          <div className="group bg-white rounded-2xl p-6 border-2 border-green-100 hover:border-green-300 transition-all hover:shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Users className="h-7 w-7 text-white" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">Lavoratori Attivi</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.totalWorkers}</p>
          </div>

          <div className="group bg-white rounded-2xl p-6 border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Clock className="h-7 w-7 text-white" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">Ore Lavorate</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.totalHoursWorked.toFixed(1)}h</p>
          </div>

          <div className="group bg-white rounded-2xl p-6 border-2 border-orange-100 hover:border-orange-300 transition-all hover:shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">Media Turni/Persona</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.avgShiftsPerWorker.toFixed(1)}</p>
          </div>
        </div>

        {/* Ore per Utente - Tabella Moderna */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200">
          <button
            onClick={() => toggleSection('users')}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all rounded-t-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Ore per Utente</h2>
            </div>
            {expandedSections.users ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
          </button>
          
          {expandedSections.users && (
            <div className="p-6 border-t-2 border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-4 px-4 font-bold text-gray-800 text-sm uppercase tracking-wide">Utente</th>
                      <th className="text-right py-4 px-4 font-bold text-gray-800 text-sm uppercase tracking-wide">Turni</th>
                      <th className="text-right py-4 px-4 font-bold text-gray-800 text-sm uppercase tracking-wide">Ore Totali</th>
                      <th className="text-right py-4 px-4 font-bold text-gray-800 text-sm uppercase tracking-wide">Media</th>
                      <th className="text-right py-4 px-4 font-bold text-gray-800 text-sm uppercase tracking-wide">Approvate</th>
                      <th className="text-right py-4 px-4 font-bold text-gray-800 text-sm uppercase tracking-wide">Pendenti</th>
                      <th className="text-right py-4 px-4 font-bold text-gray-800 text-sm uppercase tracking-wide">Rifiutate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.userHoursStats.map((user, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                        <td className="py-4 px-4 font-bold text-gray-900">{user.username}</td>
                        <td className="py-4 px-4 text-right">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-bold text-sm">{user.totalShifts}</span>
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-gray-900 text-lg">{user.totalHours.toFixed(1)}h</td>
                        <td className="py-4 px-4 text-right text-gray-600 font-medium">{user.avgHoursPerShift.toFixed(1)}h</td>
                        <td className="py-4 px-4 text-right">
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-bold text-sm">{user.approvedHours.toFixed(1)}h</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-bold text-sm">{user.pendingHours.toFixed(1)}h</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg font-bold text-sm">{user.rejectedHours.toFixed(1)}h</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Distribuzione Ruoli */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200">
          <button
            onClick={() => toggleSection('roles')}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-purple-50 hover:to-transparent transition-all rounded-t-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                <Award className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Distribuzione per Ruolo</h2>
            </div>
            {expandedSections.roles ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
          </button>
          
          {expandedSections.roles && (
            <div className="p-6 border-t-2 border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {analytics.roleDistribution.map((role, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-purple-50 via-white to-purple-50/30 rounded-2xl p-5 border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-lg">
                    <div className="text-sm font-bold text-purple-700 mb-3 uppercase tracking-wide">{role.role}</div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">{role.totalShifts} <span className="text-lg text-gray-600">turni</span></div>
                    <div className="text-sm font-semibold text-gray-700 mb-4">{role.totalHours.toFixed(1)}h totali</div>
                    <div>
                      <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full shadow-sm"
                          style={{ width: `${role.percentage}%` }}
                        />
                      </div>
                      <div className="text-xs font-bold text-purple-600 mt-2">{role.percentage.toFixed(1)}% del totale</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Distribuzione per Giorno */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200">
          <button
            onClick={() => toggleSection('days')}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-green-50 hover:to-transparent transition-all rounded-t-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-sm">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Distribuzione per Giorno</h2>
            </div>
            {expandedSections.days ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
          </button>
          
          {expandedSections.days && (
            <div className="p-6 border-t-2 border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                {analytics.dayDistribution.map((day, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-green-50 via-white to-green-50/30 rounded-2xl p-4 border-2 border-green-100 hover:border-green-300 transition-all hover:shadow-lg text-center">
                    <div className="text-xs font-bold text-green-700 mb-3 uppercase tracking-wider">{day.day}</div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">{day.totalShifts}</div>
                    <div className="text-xs text-gray-600 font-medium mb-2">turni</div>
                    <div className="text-xs text-gray-700 font-semibold">{day.totalWorkers} lavoratori</div>
                    <div className="text-xs text-green-600 mt-2 font-bold">
                      Avg: {day.avgWorkersPerShift.toFixed(1)}/turno
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tipo Turno e Trasporti */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Distribuzione Turni</h2>
            </div>
            <div className="space-y-3">
              {analytics.shiftTypeDistribution.map((shift, idx) => (
                <div key={idx} className="flex items-center justify-between bg-orange-50/50 rounded-xl p-3 border border-orange-100">
                  <span className="font-bold text-gray-900">{shift.shiftType}</span>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg font-bold text-sm">{shift.totalShifts} turni</span>
                    <span className="text-lg font-bold text-orange-600">{shift.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trasporti */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-sm">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Utilizzo Trasporti</h2>
            </div>
            <div className="space-y-3">
              {Object.entries(analytics.transportStats).map(([transport, count], idx) => (
                <div key={idx} className="flex items-center justify-between bg-cyan-50/50 rounded-xl p-3 border border-cyan-100">
                  <span className="font-bold text-gray-900 capitalize">{transport}</span>
                  <span className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-bold text-xl shadow-sm">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Copertura Turni */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200">
          <button
            onClick={() => toggleSection('coverage')}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-indigo-50 hover:to-transparent transition-all rounded-t-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <Percent className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Copertura Turni</h2>
              <span className={`text-sm font-bold px-4 py-1.5 rounded-xl shadow-sm ${
                analytics.coverageStats.coveragePercentage >= 90 
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                  : analytics.coverageStats.coveragePercentage >= 70
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
                  : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
              }`}>
                {analytics.coverageStats.coveragePercentage.toFixed(1)}%
              </span>
            </div>
            {expandedSections.coverage ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
          </button>
          
          {expandedSections.coverage && (
            <div className="p-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{analytics.coverageStats.totalRequiredSlots}</div>
                  <div className="text-sm text-gray-600 mt-1">Slot Richiesti</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{analytics.coverageStats.totalFilledSlots}</div>
                  <div className="text-sm text-gray-600 mt-1">Slot Riempiti</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {analytics.coverageStats.totalRequiredSlots - analytics.coverageStats.totalFilledSlots}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Slot Mancanti</div>
                </div>
              </div>
              
              {analytics.coverageStats.gaps.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Turni Scoperti
                  </h3>
                  <div className="space-y-2">
                    {analytics.coverageStats.gaps.map((gap, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">{gap.day}</span>
                          <span className="text-sm text-gray-600">{gap.shiftType}</span>
                          <span className="text-sm text-gray-600">-</span>
                          <span className="text-sm font-medium text-gray-700">{gap.role}</span>
                        </div>
                        <span className="text-red-600 font-semibold">Mancano {gap.missing}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sostituzioni */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200">
          <button
            onClick={() => toggleSection('substitutions')}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-cyan-50 hover:to-transparent transition-all rounded-t-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Sostituzioni</h2>
            </div>
            {expandedSections.substitutions ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
          </button>
          
          {expandedSections.substitutions && (
            <div className="p-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{analytics.substitutionStats.totalRequests}</div>
                  <div className="text-sm text-gray-600 mt-1">Richieste Totali</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{analytics.substitutionStats.pending}</div>
                  <div className="text-sm text-gray-600 mt-1">In Attesa</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{analytics.substitutionStats.approved}</div>
                  <div className="text-sm text-gray-600 mt-1">Approvate</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{analytics.substitutionStats.rejected}</div>
                  <div className="text-sm text-gray-600 mt-1">Rifiutate</div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <div className="text-sm text-gray-600">Tempo Medio di Risposta</div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {analytics.substitutionStats.avgResponseTime.toFixed(1)} ore
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top Performers */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200">
          <button
            onClick={() => toggleSection('performers')}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-yellow-50 hover:to-transparent transition-all rounded-t-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl flex items-center justify-center shadow-sm">
                <Award className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Top Performers</h2>
            </div>
            {expandedSections.performers ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
          </button>
          
          {expandedSections.performers && (
            <div className="p-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analytics.topPerformers.map((performer, idx) => (
                  <div key={idx} className="relative bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-6 border-2 border-yellow-200">
                    {idx === 0 && (
                      <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg shadow-lg">
                        🏆
                      </div>
                    )}
                    <div className="text-lg font-bold text-gray-900 mb-2">{performer.username}</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Turni:</span>
                        <span className="font-semibold text-gray-900">{performer.totalShifts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ore:</span>
                        <span className="font-semibold text-gray-900">{performer.totalHours.toFixed(1)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Affidabilità:</span>
                        <span className={`font-semibold ${
                          performer.reliability >= 95 ? 'text-green-600' :
                          performer.reliability >= 85 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {performer.reliability.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assenze */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200">
          <button
            onClick={() => toggleSection('absences')}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-red-50 hover:to-transparent transition-all rounded-t-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Assenze</h2>
            </div>
            {expandedSections.absences ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
          </button>
          
          {expandedSections.absences && (
            <div className="p-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{analytics.absenceStats.totalAbsences}</div>
                  <div className="text-sm text-gray-600 mt-1">Assenze Totali</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{analytics.absenceStats.activeAbsences}</div>
                  <div className="text-sm text-gray-600 mt-1">Assenze Attive</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{analytics.absenceStats.avgAbsenceDuration.toFixed(1)}</div>
                  <div className="text-sm text-gray-600 mt-1">Giorni Medi</div>
                </div>
              </div>
              
              {analytics.absenceStats.topAbsences.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Utenti con Più Assenze</h3>
                  <div className="space-y-2">
                    {analytics.absenceStats.topAbsences.map((absence, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                        <span className="font-medium text-gray-900">{absence.username}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">{absence.absenceCount} assenze</span>
                          <span className="text-sm font-semibold text-gray-900">{absence.totalDays} giorni</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}

