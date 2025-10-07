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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 mt-1">Analisi dettagliate e statistiche</p>
          </div>
          
          {/* Week Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(subWeeks(weekStart, 1))}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Settimana Prec.
            </button>
            <div className="px-4 py-2 border border-gray-300 rounded-lg bg-white font-medium">
              {format(weekStart, 'dd MMM yyyy', { locale: it })}
            </div>
            <button
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Settimana Succ. →
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Turni Totali</p>
                <p className="text-3xl font-bold mt-2">{analytics.totalShifts}</p>
              </div>
              <Calendar className="h-12 w-12 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Lavoratori Attivi</p>
                <p className="text-3xl font-bold mt-2">{analytics.totalWorkers}</p>
              </div>
              <Users className="h-12 w-12 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Ore Lavorate</p>
                <p className="text-3xl font-bold mt-2">{analytics.totalHoursWorked.toFixed(1)}h</p>
              </div>
              <Clock className="h-12 w-12 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Media Turni/Persona</p>
                <p className="text-3xl font-bold mt-2">{analytics.avgShiftsPerWorker.toFixed(1)}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-orange-200" />
            </div>
          </div>
        </div>

        {/* Ore per Utente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('users')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Ore per Utente</h2>
            </div>
            {expandedSections.users ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          
          {expandedSections.users && (
            <div className="p-6 border-t border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Utente</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Turni</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Ore Totali</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Media Ore/Turno</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Approvate</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Pendenti</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Rifiutate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.userHoursStats.map((user, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{user.username}</td>
                        <td className="py-3 px-4 text-right">{user.totalShifts}</td>
                        <td className="py-3 px-4 text-right font-semibold">{user.totalHours.toFixed(1)}h</td>
                        <td className="py-3 px-4 text-right text-gray-600">{user.avgHoursPerShift.toFixed(1)}h</td>
                        <td className="py-3 px-4 text-right text-green-600">{user.approvedHours.toFixed(1)}h</td>
                        <td className="py-3 px-4 text-right text-yellow-600">{user.pendingHours.toFixed(1)}h</td>
                        <td className="py-3 px-4 text-right text-red-600">{user.rejectedHours.toFixed(1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Distribuzione Ruoli */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('roles')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">Distribuzione per Ruolo</h2>
            </div>
            {expandedSections.roles ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          
          {expandedSections.roles && (
            <div className="p-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {analytics.roleDistribution.map((role, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">{role.role}</div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{role.totalShifts} turni</div>
                    <div className="text-sm text-gray-600">{role.totalHours.toFixed(1)}h totali</div>
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                          style={{ width: `${role.percentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{role.percentage.toFixed(1)}% del totale</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Distribuzione per Giorno */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('days')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">Distribuzione per Giorno</h2>
            </div>
            {expandedSections.days ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          
          {expandedSections.days && (
            <div className="p-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {analytics.dayDistribution.map((day, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                    <div className="text-sm font-semibold text-green-700 mb-2">{day.day}</div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{day.totalShifts}</div>
                    <div className="text-xs text-gray-600">turni</div>
                    <div className="text-xs text-gray-600 mt-1">{day.totalWorkers} lavoratori</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Avg: {day.avgWorkersPerShift.toFixed(1)}/turno
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tipo Turno */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-5 w-5 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-900">Distribuzione Turni</h2>
            </div>
            <div className="space-y-3">
              {analytics.shiftTypeDistribution.map((shift, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">{shift.shiftType}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600">{shift.totalShifts} turni</span>
                    <span className="text-sm font-semibold text-orange-600">{shift.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trasporti */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Utilizzo Trasporti</h2>
            </div>
            <div className="space-y-3">
              {Object.entries(analytics.transportStats).map(([transport, count], idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 capitalize">{transport}</span>
                  <span className="text-2xl font-bold text-blue-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Copertura Turni */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('coverage')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Percent className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">Copertura Turni</h2>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                analytics.coverageStats.coveragePercentage >= 90 
                  ? 'bg-green-100 text-green-700'
                  : analytics.coverageStats.coveragePercentage >= 70
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {analytics.coverageStats.coveragePercentage.toFixed(1)}%
              </span>
            </div>
            {expandedSections.coverage ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('substitutions')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-cyan-600" />
              <h2 className="text-xl font-bold text-gray-900">Sostituzioni</h2>
            </div>
            {expandedSections.substitutions ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('performers')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-yellow-600" />
              <h2 className="text-xl font-bold text-gray-900">Top Performers</h2>
            </div>
            {expandedSections.performers ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('absences')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">Assenze</h2>
            </div>
            {expandedSections.absences ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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

