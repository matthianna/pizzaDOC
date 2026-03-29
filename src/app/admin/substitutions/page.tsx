'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Users, Check, X, Clock, AlertCircle, CheckCircle, XCircle, User, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { addWeekCalendarDays } from '@/lib/date-utils'
import { Role, ShiftType, SubstitutionStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select as ReactSelect } from '@/components/ui/react-select'
import { useToast } from '@/components/ui/toast'

interface Shift {
  id: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  schedules: {
    weekStart: string
  }
}

interface User {
  id: string
  username: string
  primaryRole?: Role
}

interface Substitution {
  id: string
  shiftId: string
  requesterId: string
  substituteId?: string
  status: SubstitutionStatus
  requestNote?: string
  responseNote?: string
  deadline: string
  createdAt: string
  shifts: Shift
  requester: User
  substitute?: User
}

export default function AdminSubstitutionsPage() {
  const [substitutions, setSubstitutions] = useState<Substitution[]>([])
  const [filterStatus, setFilterStatus] = useState<SubstitutionStatus | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedSubstitution, setSelectedSubstitution] = useState<Substitution | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    fetchSubstitutions()
  }, [filterStatus])

  const fetchSubstitutions = async () => {
    setLoading(true)
    try {
      let url = '/api/admin/substitutions'
      if (filterStatus !== 'ALL') {
        url += `?status=${filterStatus}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSubstitutions(data)
      }
    } catch (error) {
      console.error('Error fetching substitutions:', error)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setLoading(false)
    }
  }

  const approveSubstitution = async (substitutionId: string) => {
    setProcessingId(substitutionId)
    try {
      const response = await fetch(`/api/admin/substitutions/${substitutionId}/approve`, {
        method: 'POST',
      })

      if (response.ok) {
        showToast('Sostituzione approvata!', 'success')
        fetchSubstitutions()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'approvazione', 'error')
      }
    } catch (error) {
      console.error('Error approving substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const rejectSubstitution = async () => {
    if (!selectedSubstitution) return

    setProcessingId(selectedSubstitution.id)
    try {
      const response = await fetch(`/api/admin/substitutions/${selectedSubstitution.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responseNote: rejectReason.trim() || null
        }),
      })

      if (response.ok) {
        showToast('Sostituzione rifiutata', 'success')
        setShowRejectModal(false)
        setSelectedSubstitution(null)
        setRejectReason('')
        fetchSubstitutions()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nel rifiuto', 'error')
      }
    } catch (error) {
      console.error('Error rejecting substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const getShiftDate = (shift: Shift) => {
    const weekStart = new Date(shift.schedules.weekStart)
    // dayOfWeek è già nel formato corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica
    return addWeekCalendarDays(weekStart, shift.dayOfWeek)
  }

  const getStatusIcon = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'APPLIED':
        return <User className="h-4 w-4 text-blue-500" />
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'EXPIRED':
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING':
        return 'In attesa candidati'
      case 'APPLIED':
        return 'Da approvare'
      case 'APPROVED':
        return 'Approvata'
      case 'REJECTED':
        return 'Rifiutata'
      case 'EXPIRED':
        return 'Scaduta'
    }
  }

  const getStatusColor = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'APPLIED':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'APPROVED':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'EXPIRED':
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const pendingCount = substitutions.filter(s => s.status === 'APPLIED').length

  return (
    <MainLayout adminOnly>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Moderno */}
        <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-orange-600 rounded-2xl shadow-lg shadow-orange-200">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  Gestione Sostituzioni
                </h1>
                <p className="text-gray-500 font-medium mt-1">
                  Approva o rifiuta le richieste di cambio turno in tempo reale.
                </p>
              </div>
            </div>
            {pendingCount > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl px-6 py-4 flex items-center gap-3 animate-pulse">
                <div className="w-3 h-3 bg-orange-500 rounded-full" />
                <span className="text-orange-900 font-black text-sm uppercase tracking-wider">
                  {pendingCount} da approvare
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filtri Moderni */}
        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-2 flex items-center gap-1 overflow-x-auto scrollbar-hide border border-gray-100 shadow-sm">
          {[
            { value: 'ALL', label: 'Tutti' },
            { value: 'PENDING', label: 'In attesa' },
            { value: 'APPLIED', label: 'Da approvare' },
            { value: 'APPROVED', label: 'Approvate' },
            { value: 'REJECTED', label: 'Rifiutate' },
            { value: 'EXPIRED', label: 'Scadute' }
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value as SubstitutionStatus | 'ALL')}
              className={cn(
                "px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap",
                filterStatus === filter.value
                  ? "bg-white text-orange-600 shadow-md ring-1 ring-orange-100"
                  : "text-gray-500 hover:bg-white/50 hover:text-gray-900"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Substitutions List Moderna */}
        <div className="grid grid-cols-1 gap-6">
          {loading ? (
            <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-6"></div>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Caricamento richieste...</p>
            </div>
          ) : substitutions.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-soft border border-dashed border-gray-300 p-20 text-center">
              <div className="p-4 bg-gray-50 rounded-full w-fit mx-auto mb-4">
                <Users className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Nessuna sostituzione trovata</p>
            </div>
          ) : (
            substitutions.map((substitution) => {
              const shiftDate = getShiftDate(substitution.shifts)
              const canApprove = substitution.status === 'APPLIED'
              const canReject = ['PENDING', 'APPLIED'].includes(substitution.status)
              
              return (
                <div key={substitution.id} className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden hover:shadow-xl transition-all group">
                  <div className="flex flex-col lg:flex-row">
                    {/* Status Sidebar */}
                    <div className={cn(
                      "lg:w-48 p-6 flex lg:flex-col items-center justify-center text-center gap-3",
                      substitution.status === 'APPLIED' ? "bg-blue-50" :
                      substitution.status === 'APPROVED' ? "bg-green-50" :
                      substitution.status === 'REJECTED' ? "bg-red-50" : "bg-gray-50"
                    )}>
                      <div className={cn(
                        "p-3 rounded-2xl bg-white shadow-sm",
                        substitution.status === 'APPLIED' ? "text-blue-600" :
                        substitution.status === 'APPROVED' ? "text-green-600" :
                        substitution.status === 'REJECTED' ? "text-red-600" : "text-gray-400"
                      )}>
                        {getStatusIcon(substitution.status)}
                      </div>
                      <div className="text-center">
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          substitution.status === 'APPLIED' ? "text-blue-600" :
                          substitution.status === 'APPROVED' ? "text-green-600" :
                          substitution.status === 'REJECTED' ? "text-red-600" : "text-gray-400"
                        )}>
                          {getStatusText(substitution.status)}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1">
                          {format(parseISO(substitution.createdAt), 'dd MMM, HH:mm')}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 p-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Turno */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="h-3 w-3" /> Turno Originale
                          </h3>
                          <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                            <p className="text-sm font-black text-gray-900">{getDayName(substitution.shifts.dayOfWeek)} {format(shiftDate, 'd MMM')}</p>
                            <p className="text-xs font-bold text-orange-600 uppercase">{getShiftTypeName(substitution.shifts.shiftType)} • {substitution.shifts.startTime} - {substitution.shifts.endTime}</p>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider bg-white w-fit px-2 py-1 rounded-md border border-gray-100">{getRoleName(substitution.shifts.role)}</p>
                          </div>
                        </div>

                        {/* Richiesta */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <User className="h-3 w-3" /> Da chi
                          </h3>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-black text-orange-600 text-sm border-2 border-white shadow-sm">
                                {substitution.requester.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-black text-gray-900">{substitution.requester.username}</p>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">{getRoleName(substitution.requester.primaryRole || 'DIPENDENTE')}</p>
                              </div>
                            </div>
                            {substitution.requestNote && (
                              <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 relative">
                                <div className="absolute -top-2 -left-2 text-2xl text-orange-200">“</div>
                                <p className="text-xs text-orange-800 italic font-medium leading-relaxed">{substitution.requestNote}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sostituto */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Users className="h-3 w-3" /> Chi sostituisce
                          </h3>
                          {substitution.substitute ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-black text-blue-600 text-sm border-2 border-white shadow-sm">
                                  {substitution.substitute.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-gray-900">{substitution.substitute.username}</p>
                                  <p className="text-[10px] font-bold text-gray-500 uppercase">{getRoleName(substitution.substitute.primaryRole || 'DIPENDENTE')}</p>
                                </div>
                              </div>
                              <div className="bg-green-50 px-3 py-2 rounded-xl border border-green-100 flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-600" />
                                <span className="text-[10px] font-black text-green-700 uppercase">Candidato Disponibile</span>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-2xl p-6 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">In attesa di</p>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">un candidato</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {(canApprove || canReject) && (
                        <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                          {canReject && (
                            <button
                              onClick={() => {
                                setSelectedSubstitution(substitution)
                                setShowRejectModal(true)
                              }}
                              disabled={processingId === substitution.id}
                              className="px-6 py-3 text-xs font-black uppercase tracking-widest text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all disabled:opacity-50"
                            >
                              Rifiuta
                            </button>
                          )}
                          {canApprove && (
                            <button
                              onClick={() => approveSubstitution(substitution.id)}
                              disabled={processingId === substitution.id}
                              className="px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              {processingId === substitution.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              {processingId === substitution.id ? 'Approvazione...' : 'Approva Sostituzione'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Response Note */}
                      {substitution.responseNote && (
                        <div className="mt-6 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-1">Motivo del rifiuto</p>
                            <p className="text-xs text-red-700 font-medium leading-relaxed">{substitution.responseNote}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Reject Modal Moderno */}
        {showRejectModal && selectedSubstitution && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-2xl">
                      <XCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">
                      Rifiuta Sostituzione
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowRejectModal(false)
                      setSelectedSubstitution(null)
                      setRejectReason('')
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100">
                    <p className="text-xs font-bold text-orange-900 leading-relaxed">
                      Stai per rifiutare la richiesta di <span className="font-black underline">{selectedSubstitution.requester.username}</span> per il turno del 
                      <span className="font-black"> {getDayName(selectedSubstitution.shifts.dayOfWeek)} {format(getShiftDate(selectedSubstitution.shifts), 'd MMM')}</span>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
                      Motivo del rifiuto (opzionale)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={4}
                      className="w-full bg-gray-50 border-gray-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
                      placeholder="Spiega brevemente perché la richiesta non può essere accettata..."
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => {
                      setShowRejectModal(false)
                      setSelectedSubstitution(null)
                      setRejectReason('')
                    }}
                    className="flex-1 px-6 py-4 text-sm font-black uppercase tracking-widest text-gray-500 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={rejectSubstitution}
                    disabled={processingId === selectedSubstitution.id}
                    className="flex-[2] px-6 py-4 bg-red-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-200 hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {processingId === selectedSubstitution.id ? 'Rifiuto in corso...' : 'Rifiuta Richiesta'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}
