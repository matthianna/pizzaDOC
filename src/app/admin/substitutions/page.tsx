'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Users, Check, Clock, AlertCircle, CheckCircle, XCircle, User, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { addWeekCalendarDays } from '@/lib/date-utils'
import { Role, ShiftType, SubstitutionStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Select as ReactSelect } from '@/components/ui/react-select'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

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
        return <Clock className="h-4 w-4 text-[var(--pd-warning)]" />
      case 'APPLIED':
        return <User className="h-4 w-4 text-[var(--pd-accent)]" />
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-[var(--pd-success)]" />
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-[var(--pd-danger)]" />
      case 'EXPIRED':
        return <AlertCircle className="h-4 w-4 text-[var(--pd-muted)]" />
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
        return 'bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] border-[var(--pd-border)]'
      case 'APPROVED':
        return 'bg-[var(--pd-success-soft)] text-[var(--pd-success)] border-[var(--pd-border)]'
      case 'REJECTED':
        return 'bg-[var(--pd-danger-soft)] text-[var(--pd-danger)] border-[var(--pd-border)]'
      case 'EXPIRED':
        return 'bg-[var(--pd-surface-muted)] text-[var(--pd-text)] border-[var(--pd-border)]'
    }
  }

  const pendingCount = substitutions.filter(s => s.status === 'APPLIED').length

  return (
    <MainLayout adminOnly>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Moderno */}
        <div className="bg-[var(--pd-surface)] rounded-3xl shadow-[var(--pd-shadow)] border border-[var(--pd-border)] p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-[var(--pd-accent)] rounded-2xl shadow-lg shadow-[var(--pd-shadow)]">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="pd-display text-3xl font-semibold text-[var(--pd-text)] tracking-tight">
                  Gestione Sostituzioni
                </h1>
                <p className="text-[var(--pd-muted)] font-medium mt-1">
                  Approva o rifiuta le richieste di cambio turno in tempo reale.
                </p>
              </div>
            </div>
            {pendingCount > 0 && (
              <div className="bg-[var(--pd-accent-soft)] border border-[var(--pd-border)] rounded-2xl px-6 py-4 flex items-center gap-3 animate-pulse">
                <div className="w-3 h-3 bg-[var(--pd-accent)] rounded-full" />
                <span className="text-orange-900 font-black text-sm uppercase tracking-wider">
                  {pendingCount} da approvare
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filtri Moderni */}
        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-2 flex items-center gap-1 overflow-x-auto scrollbar-hide border border-[var(--pd-border)] shadow-sm">
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
                  ? "bg-[var(--pd-surface)] text-[var(--pd-accent)] shadow-md ring-1 ring-orange-100"
                  : "text-[var(--pd-muted)] hover:bg-white/50 hover:text-[var(--pd-text)]"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Substitutions List Moderna */}
        <div className="grid grid-cols-1 gap-6">
          {loading ? (
            <div className="bg-[var(--pd-surface)] rounded-3xl shadow-[var(--pd-shadow)] border border-[var(--pd-border)] p-20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--pd-accent)] mx-auto mb-6"></div>
              <p className="text-[var(--pd-muted)] font-bold uppercase tracking-widest text-xs">Caricamento richieste...</p>
            </div>
          ) : substitutions.length === 0 ? (
            <div className="bg-[var(--pd-surface)] rounded-3xl shadow-[var(--pd-shadow)] border border-dashed border-[var(--pd-border-strong)] p-20 text-center">
              <div className="p-4 bg-[var(--pd-surface-muted)] rounded-full w-fit mx-auto mb-4">
                <Users className="h-10 w-10 text-[var(--pd-muted)]/50" />
              </div>
              <p className="text-[var(--pd-muted)] font-bold uppercase tracking-widest text-sm">Nessuna sostituzione trovata</p>
            </div>
          ) : (
            substitutions.map((substitution) => {
              const shiftDate = getShiftDate(substitution.shifts)
              const canApprove = substitution.status === 'APPLIED'
              const canReject = ['PENDING', 'APPLIED'].includes(substitution.status)
              
              return (
                <div key={substitution.id} className="bg-[var(--pd-surface)] rounded-3xl shadow-[var(--pd-shadow)] border border-[var(--pd-border)] overflow-hidden hover:shadow-xl transition-all group">
                  <div className="flex flex-col lg:flex-row">
                    {/* Status Sidebar */}
                    <div className={cn(
                      "lg:w-48 p-6 flex lg:flex-col items-center justify-center text-center gap-3",
                      substitution.status === 'APPLIED' ? "bg-[var(--pd-accent-soft)]" :
                      substitution.status === 'APPROVED' ? "bg-[var(--pd-success-soft)]" :
                      substitution.status === 'REJECTED' ? "bg-[var(--pd-danger-soft)]" : "bg-[var(--pd-surface-muted)]"
                    )}>
                      <div className={cn(
                        "p-3 rounded-2xl bg-white shadow-sm",
                        substitution.status === 'APPLIED' ? "text-[var(--pd-accent)]" :
                        substitution.status === 'APPROVED' ? "text-[var(--pd-success)]" :
                        substitution.status === 'REJECTED' ? "text-[var(--pd-danger)]" : "text-[var(--pd-muted)]"
                      )}>
                        {getStatusIcon(substitution.status)}
                      </div>
                      <div className="text-center">
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          substitution.status === 'APPLIED' ? "text-[var(--pd-accent)]" :
                          substitution.status === 'APPROVED' ? "text-[var(--pd-success)]" :
                          substitution.status === 'REJECTED' ? "text-[var(--pd-danger)]" : "text-[var(--pd-muted)]"
                        )}>
                          {getStatusText(substitution.status)}
                        </p>
                        <p className="text-[10px] font-bold text-[var(--pd-muted)] mt-1">
                          {format(parseISO(substitution.createdAt), 'dd MMM, HH:mm')}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 p-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Turno */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest flex items-center gap-2">
                            <Clock className="h-3 w-3" /> Turno Originale
                          </h3>
                          <div className="bg-[var(--pd-surface-muted)] rounded-2xl p-4 space-y-2">
                            <p className="text-sm font-black text-[var(--pd-text)]">{getDayName(substitution.shifts.dayOfWeek)} {format(shiftDate, 'd MMM')}</p>
                            <p className="text-xs font-bold text-[var(--pd-accent)] uppercase">{getShiftTypeName(substitution.shifts.shiftType)} • {substitution.shifts.startTime} - {substitution.shifts.endTime}</p>
                            <p className="text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-wider bg-white w-fit px-2 py-1 rounded-md border border-[var(--pd-border)]">{getRoleName(substitution.shifts.role)}</p>
                          </div>
                        </div>

                        {/* Richiesta */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest flex items-center gap-2">
                            <User className="h-3 w-3" /> Da chi
                          </h3>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[var(--pd-accent-soft)] flex items-center justify-center font-black text-[var(--pd-accent)] text-sm border-2 border-white shadow-sm">
                                {substitution.requester.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-black text-[var(--pd-text)]">{substitution.requester.username}</p>
                                <p className="text-[10px] font-bold text-[var(--pd-muted)] uppercase">{getRoleName(substitution.requester.primaryRole || 'DIPENDENTE')}</p>
                              </div>
                            </div>
                            {substitution.requestNote && (
                              <div className="bg-[var(--pd-accent-soft)]/50 p-3 rounded-xl border border-[var(--pd-border)] relative">
                                <div className="absolute -top-2 -left-2 text-2xl text-orange-200">“</div>
                                <p className="text-xs text-orange-800 italic font-medium leading-relaxed">{substitution.requestNote}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sostituto */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest flex items-center gap-2">
                            <Users className="h-3 w-3" /> Chi sostituisce
                          </h3>
                          {substitution.substitute ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--pd-accent-soft)] flex items-center justify-center font-black text-[var(--pd-accent)] text-sm border-2 border-white shadow-sm">
                                  {substitution.substitute.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-[var(--pd-text)]">{substitution.substitute.username}</p>
                                  <p className="text-[10px] font-bold text-[var(--pd-muted)] uppercase">{getRoleName(substitution.substitute.primaryRole || 'DIPENDENTE')}</p>
                                </div>
                              </div>
                              <div className="bg-[var(--pd-success-soft)] px-3 py-2 rounded-xl border border-green-100 flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-[var(--pd-success)]" />
                                <span className="text-[10px] font-black text-[var(--pd-success)] uppercase">Candidato Disponibile</span>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-[var(--pd-surface-muted)] rounded-2xl p-6 border border-dashed border-[var(--pd-border)] flex flex-col items-center justify-center text-center">
                              <p className="text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-widest">In attesa di</p>
                              <p className="text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-widest">un candidato</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {(canApprove || canReject) && (
                        <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-[var(--pd-border)]">
                          {canReject && (
                            <button
                              onClick={() => {
                                setSelectedSubstitution(substitution)
                                setShowRejectModal(true)
                              }}
                              disabled={processingId === substitution.id}
                              className="px-6 py-3 text-xs font-black uppercase tracking-widest text-[var(--pd-danger)] bg-[var(--pd-danger-soft)] rounded-xl hover:bg-[var(--pd-danger-soft)] transition-all disabled:opacity-50"
                            >
                              Rifiuta
                            </button>
                          )}
                          {canApprove && (
                            <button
                              onClick={() => approveSubstitution(substitution.id)}
                              disabled={processingId === substitution.id}
                              className="px-8 py-3 bg-[var(--pd-accent)] text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--pd-shadow)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
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
                        <div className="mt-6 bg-[var(--pd-danger-soft)] border border-[var(--pd-border)] rounded-2xl p-4 flex items-start gap-3">
                          <AlertCircle className="h-4 w-4 text-[var(--pd-danger)] shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-1">Motivo del rifiuto</p>
                            <p className="text-xs text-[var(--pd-danger)] font-medium leading-relaxed">{substitution.responseNote}</p>
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

        <Modal
          isOpen={showRejectModal && !!selectedSubstitution}
          onClose={() => {
            if (processingId) return
            setShowRejectModal(false)
            setSelectedSubstitution(null)
            setRejectReason('')
          }}
          title="Rifiuta sostituzione"
          subtitle={
            selectedSubstitution
              ? `${selectedSubstitution.requester.username} · ${getDayName(selectedSubstitution.shifts.dayOfWeek)} ${format(getShiftDate(selectedSubstitution.shifts), 'd MMM')}`
              : undefined
          }
          maxWidth="md"
          headerIcon={<XCircle className="h-6 w-6" />}
        >
          {selectedSubstitution && (
            <div className="space-y-5">
              <div
                className="rounded-2xl p-4 border"
                style={{
                  background: 'var(--pd-accent-soft)',
                  borderColor: 'var(--pd-border)',
                }}
              >
                <p className="text-sm leading-relaxed" style={{ color: 'var(--pd-text)' }}>
                  Stai per rifiutare la richiesta di{' '}
                  <span className="font-semibold">{selectedSubstitution.requester.username}</span> per
                  il turno del{' '}
                  <span className="font-semibold">
                    {getDayName(selectedSubstitution.shifts.dayOfWeek)}{' '}
                    {format(getShiftDate(selectedSubstitution.shifts), 'd MMM')}
                  </span>
                  .
                </p>
              </div>

              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: 'var(--pd-muted)' }}
                >
                  Motivo del rifiuto (opzionale)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl p-4 text-sm font-medium resize-none border focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    borderColor: 'var(--pd-border)',
                    color: 'var(--pd-text)',
                  }}
                  placeholder="Spiega brevemente perché la richiesta non può essere accettata..."
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={processingId === selectedSubstitution.id}
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedSubstitution(null)
                    setRejectReason('')
                  }}
                >
                  Annulla
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="flex-[2]"
                  onClick={rejectSubstitution}
                  disabled={processingId === selectedSubstitution.id}
                  isLoading={processingId === selectedSubstitution.id}
                >
                  Rifiuta richiesta
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
      <ToastContainer />
    </MainLayout>
  )
}
