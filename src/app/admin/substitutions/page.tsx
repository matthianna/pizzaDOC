'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Users, Check, Clock, AlertCircle, CheckCircle, XCircle, User, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { addWeekCalendarDays } from '@/lib/date-utils'
import { Role, ShiftType, SubstitutionStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState } from '@/components/ui/list-row'

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


  const pendingCount = substitutions.filter(s => s.status === 'APPLIED').length

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <ToastContainer />
      <div className="pd-page pb-16">
        <PageHeader
          dense
          title="Sostituzioni"
          subtitle="Approva o rifiuta i cambi turno"
        />

        <div
          className="flex flex-wrap gap-1 p-2 overflow-x-auto"
          style={{
            background: 'var(--pd-surface)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-lg)',
          }}
        >
          {(
            [
              { value: 'ALL', label: 'Tutti' },
              { value: 'PENDING', label: 'In attesa' },
              { value: 'APPLIED', label: 'Da approvare' },
              { value: 'APPROVED', label: 'Approvate' },
              { value: 'REJECTED', label: 'Rifiutate' },
              { value: 'EXPIRED', label: 'Scadute' },
            ] as const
          ).map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setFilterStatus(filter.value as SubstitutionStatus | 'ALL')}
              className="px-3 py-2 text-sm font-semibold whitespace-nowrap pd-press"
              style={{
                background: filterStatus === filter.value ? 'var(--pd-accent-soft)' : 'transparent',
                color: filterStatus === filter.value ? 'var(--pd-accent)' : 'var(--pd-muted)',
                borderRadius: 'var(--pd-radius)',
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <StatStrip
          items={[
            { label: 'Richieste', value: loading ? '—' : substitutions.length },
            { label: 'Da approvare', value: loading ? '—' : pendingCount },
          ]}
        />

        <SectionBlock title="Richieste" card>
          {loading ? (
            <div className="py-16 text-center">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3"
                style={{ borderColor: 'var(--pd-accent)' }}
              />
              <p className="text-sm" style={{ color: 'var(--pd-muted)' }}>
                Caricamento richieste...
              </p>
            </div>
          ) : substitutions.length === 0 ? (
            <EmptyState
              title="Nessuna sostituzione trovata"
              description="Non ci sono richieste per il filtro selezionato."
              icon={<Users className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
            />
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--pd-border)' }}>
              {substitutions.map((substitution) => {
                const shiftDate = getShiftDate(substitution.shifts)
                const canApprove = substitution.status === 'APPLIED'
                const canReject = ['PENDING', 'APPLIED'].includes(substitution.status)

                return (
                  <div
                    key={substitution.id}
                    className="p-4 sm:p-5 space-y-4 transition-colors hover:bg-[var(--pd-surface-muted)]/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                          {getDayName(substitution.shifts.dayOfWeek)} {format(shiftDate, 'd MMM')} ·{' '}
                          {getShiftTypeName(substitution.shifts.shiftType)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                          {substitution.shifts.startTime}–{substitution.shifts.endTime} ·{' '}
                          {getRoleName(substitution.shifts.role)} ·{' '}
                          {format(parseISO(substitution.createdAt), 'dd MMM, HH:mm')}
                        </p>
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold"
                        style={{
                          borderRadius: 'var(--pd-radius-sm)',
                          border: '1px solid var(--pd-border)',
                          background:
                            substitution.status === 'APPLIED'
                              ? 'var(--pd-accent-soft)'
                              : substitution.status === 'APPROVED'
                                ? 'var(--pd-success-soft)'
                                : substitution.status === 'REJECTED'
                                  ? 'var(--pd-danger-soft)'
                                  : 'var(--pd-surface-muted)',
                          color:
                            substitution.status === 'APPLIED'
                              ? 'var(--pd-accent)'
                              : substitution.status === 'APPROVED'
                                ? 'var(--pd-success)'
                                : substitution.status === 'REJECTED'
                                  ? 'var(--pd-danger)'
                                  : 'var(--pd-muted)',
                        }}
                      >
                        {getStatusIcon(substitution.status)}
                        {getStatusText(substitution.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--pd-muted)' }}>
                          Richiedente
                        </p>
                        <p className="font-semibold" style={{ color: 'var(--pd-text)' }}>
                          {substitution.requester.username}
                        </p>
                        {substitution.requestNote && (
                          <p className="text-xs mt-1" style={{ color: 'var(--pd-muted)' }}>
                            {substitution.requestNote}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--pd-muted)' }}>
                          Sostituto
                        </p>
                        {substitution.substitute ? (
                          <p className="font-semibold" style={{ color: 'var(--pd-text)' }}>
                            {substitution.substitute.username}
                          </p>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                            In attesa di un candidato
                          </p>
                        )}
                      </div>
                    </div>

                    {(canApprove || canReject) && (
                      <div
                        className="flex flex-wrap justify-end gap-2 pt-3"
                        style={{ borderTop: '1px solid var(--pd-border)' }}
                      >
                        {canReject && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubstitution(substitution)
                              setShowRejectModal(true)
                            }}
                            disabled={processingId === substitution.id}
                            className="px-4 py-2 text-sm font-semibold pd-press disabled:opacity-50"
                            style={{
                              color: 'var(--pd-danger)',
                              background: 'var(--pd-danger-soft)',
                              borderRadius: 'var(--pd-radius)',
                            }}
                          >
                            Rifiuta
                          </button>
                        )}
                        {canApprove && (
                          <button
                            type="button"
                            onClick={() => approveSubstitution(substitution.id)}
                            disabled={processingId === substitution.id}
                            className="pd-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                          >
                            {processingId === substitution.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            {processingId === substitution.id ? 'Approvazione...' : 'Approva'}
                          </button>
                        )}
                      </div>
                    )}

                    {substitution.responseNote && (
                      <div
                        className="flex items-start gap-2 px-3 py-2.5"
                        style={{
                          background: 'var(--pd-danger-soft)',
                          borderRadius: 'var(--pd-radius)',
                          border: '1px solid var(--pd-border)',
                        }}
                      >
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--pd-danger)' }} />
                        <div>
                          <p className="text-xs font-semibold" style={{ color: 'var(--pd-danger)' }}>
                            Motivo del rifiuto
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--pd-text)' }}>
                            {substitution.responseNote}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionBlock>

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
        >
          {selectedSubstitution && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--pd-text)' }}>
                Stai per rifiutare la richiesta di{' '}
                <span className="font-semibold">{selectedSubstitution.requester.username}</span> per il
                turno del{' '}
                <span className="font-semibold">
                  {getDayName(selectedSubstitution.shifts.dayOfWeek)}{' '}
                  {format(getShiftDate(selectedSubstitution.shifts), 'd MMM')}
                </span>
                .
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--pd-muted)' }}>
                  Motivo del rifiuto (opzionale)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="w-full p-3 text-sm font-medium resize-none border"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    borderColor: 'var(--pd-border)',
                    borderRadius: 'var(--pd-radius)',
                    color: 'var(--pd-text)',
                  }}
                  placeholder="Spiega brevemente perché la richiesta non può essere accettata..."
                />
              </div>
              <div className="flex gap-2">
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

    </MainLayout>
  )
}
