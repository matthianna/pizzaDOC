'use client'

import { useState, useEffect, useMemo } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import {
  Users,
  Check,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  RefreshCw,
  Calendar,
  ChevronDown,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName, cn, formatUsername } from '@/lib/utils'
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

const STATUS_META: Record<
  SubstitutionStatus,
  { label: string; color: string; bg: string; icon: typeof Clock }
> = {
  PENDING: {
    label: 'In attesa candidati',
    color: 'var(--pd-warning)',
    bg: 'var(--pd-warning-soft)',
    icon: Clock,
  },
  APPLIED: {
    label: 'Da approvare',
    color: 'var(--pd-accent)',
    bg: 'var(--pd-accent-soft)',
    icon: User,
  },
  APPROVED: {
    label: 'Approvata',
    color: 'var(--pd-success)',
    bg: 'var(--pd-success-soft)',
    icon: CheckCircle,
  },
  REJECTED: {
    label: 'Rifiutata',
    color: 'var(--pd-danger)',
    bg: 'var(--pd-danger-soft)',
    icon: XCircle,
  },
  EXPIRED: {
    label: 'Scaduta',
    color: 'var(--pd-muted)',
    bg: 'var(--pd-surface-muted)',
    icon: AlertCircle,
  },
  CANCELLED: {
    label: 'Annullata',
    color: 'var(--pd-muted)',
    bg: 'var(--pd-surface-muted)',
    icon: XCircle,
  },
}

const FILTERS = [
  { value: 'APPLIED' as const, label: 'Da approvare' },
  { value: 'PENDING' as const, label: 'In attesa' },
  { value: 'ALL' as const, label: 'Tutti' },
  { value: 'APPROVED' as const, label: 'Approvate' },
  { value: 'REJECTED' as const, label: 'Rifiutate' },
  { value: 'EXPIRED' as const, label: 'Scadute' },
]

export default function AdminSubstitutionsPage() {
  const [substitutions, setSubstitutions] = useState<Substitution[]>([])
  const [filterStatus, setFilterStatus] = useState<SubstitutionStatus | 'ALL'>('APPLIED')
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedSubstitution, setSelectedSubstitution] = useState<Substitution | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  /** Month keys (`yyyy-MM`) that are collapsed. Newest month starts expanded. */
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({})
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    fetchSubstitutions()
  }, [filterStatus])

  useEffect(() => {
    setCollapsedMonths({})
  }, [filterStatus])

  const getShiftDate = (shift: Shift) => {
    const weekStart = new Date(shift.schedules.weekStart)
    return addWeekCalendarDays(weekStart, shift.dayOfWeek)
  }

  const monthGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: Substitution[] }>()

    const sorted = [...substitutions].sort((a, b) => {
      const da = getShiftDate(a.shifts).getTime()
      const db = getShiftDate(b.shifts).getTime()
      return db - da
    })

    for (const sub of sorted) {
      const date = getShiftDate(sub.shifts)
      const key = format(date, 'yyyy-MM')
      const label = format(date, 'MMMM yyyy', { locale: it })
      const existing = map.get(key)
      if (existing) {
        existing.items.push(sub)
      } else {
        map.set(key, {
          key,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          items: [sub],
        })
      }
    }

    return Array.from(map.values())
  }, [substitutions])

  const isMonthCollapsed = (key: string, index: number) => {
    if (key in collapsedMonths) return collapsedMonths[key]
    return index > 0
  }

  const toggleMonth = (key: string, index: number) => {
    setCollapsedMonths((prev) => {
      const currentlyCollapsed = key in prev ? prev[key] : index > 0
      return { ...prev, [key]: !currentlyCollapsed }
    })
  }

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
        showToast(error.error || "Errore nell'approvazione", 'error')
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
          responseNote: rejectReason.trim() || null,
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

  const actionableCount = substitutions.filter((s) => s.status === 'APPLIED').length
  const filterLabel = FILTERS.find((f) => f.value === filterStatus)?.label ?? 'Tutti'

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <ToastContainer />
      <div className="pd-page pb-16">
        <PageHeader dense title="Sostituzioni" subtitle="Approva o rifiuta i cambi turno" />

        <div
          className="inline-flex p-1 gap-0.5 overflow-x-auto max-w-full"
          style={{
            background: 'var(--pd-surface-muted)',
            borderRadius: 'var(--pd-radius-pill)',
            border: '1px solid var(--pd-border)',
          }}
        >
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setFilterStatus(filter.value)}
              className="px-3.5 py-1.5 text-xs font-semibold pd-press whitespace-nowrap"
              style={{
                borderRadius: 'var(--pd-radius-pill)',
                background: filterStatus === filter.value ? 'var(--pd-surface)' : 'transparent',
                color: filterStatus === filter.value ? 'var(--pd-text)' : 'var(--pd-muted)',
                boxShadow: filterStatus === filter.value ? 'var(--pd-shadow)' : undefined,
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <StatStrip
          items={[
            { label: filterLabel, value: loading ? '—' : substitutions.length },
            {
              label: 'Da approvare',
              value: loading ? '—' : filterStatus === 'APPLIED' ? substitutions.length : actionableCount,
            },
          ]}
        />

        <SectionBlock
          title="Richieste"
          subtitle={
            loading
              ? 'Caricamento…'
              : `${substitutions.length} ${substitutions.length === 1 ? 'richiesta' : 'richieste'} · ${filterLabel.toLowerCase()}`
          }
          card
        >
          {loading ? (
            <div className="py-12 flex justify-center">
              <div
                className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                style={{ borderColor: 'var(--pd-accent)', borderTopColor: 'transparent' }}
              />
            </div>
          ) : substitutions.length === 0 ? (
            <EmptyState
              title={
                filterStatus === 'APPLIED'
                  ? 'Niente da approvare'
                  : 'Nessuna sostituzione trovata'
              }
              description={
                filterStatus === 'APPLIED'
                  ? 'Quando un collega si candida, la richiesta comparirà qui.'
                  : 'Non ci sono richieste per il filtro selezionato.'
              }
              icon={<Users className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
            />
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--pd-border)' }}>
              {monthGroups.map((group, groupIndex) => {
                const collapsed = isMonthCollapsed(group.key, groupIndex)
                return (
                  <div key={group.key}>
                    <button
                      type="button"
                      onClick={() => toggleMonth(group.key, groupIndex)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left pd-press"
                      style={{ background: 'var(--pd-surface-muted)' }}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <p
                          className="text-sm font-semibold capitalize"
                          style={{ color: 'var(--pd-text)' }}
                        >
                          {group.label}
                        </p>
                        <span
                          className="text-[11px] font-medium tabular-nums px-2 py-0.5"
                          style={{
                            color: 'var(--pd-muted)',
                            background: 'var(--pd-surface)',
                            borderRadius: 'var(--pd-radius-pill)',
                            border: '1px solid var(--pd-border)',
                          }}
                        >
                          {group.items.length}
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 transition-transform',
                          !collapsed && 'rotate-180'
                        )}
                        style={{ color: 'var(--pd-muted)' }}
                      />
                    </button>

                    {!collapsed && (
                      <div className="divide-y" style={{ borderColor: 'var(--pd-border)' }}>
                        {group.items.map((substitution) => {
                          const shiftDate = getShiftDate(substitution.shifts)
                          const canApprove = substitution.status === 'APPLIED'
                          const canReject = ['PENDING', 'APPLIED'].includes(substitution.status)
                          const meta = STATUS_META[substitution.status]
                          const StatusIcon = meta.icon

                          return (
                            <div
                              key={substitution.id}
                              className="px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
                              style={{
                                background:
                                  substitution.status === 'APPLIED'
                                    ? 'color-mix(in srgb, var(--pd-accent-soft) 50%, var(--pd-surface))'
                                    : 'transparent',
                              }}
                            >
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                                    {getDayName(substitution.shifts.dayOfWeek)}{' '}
                                    {format(shiftDate, 'd MMM', { locale: it })} ·{' '}
                                    {getShiftTypeName(substitution.shifts.shiftType)}
                                  </p>
                                  <span
                                    className="inline-flex px-2 py-0.5 text-[11px] font-medium"
                                    style={{
                                      background: 'var(--pd-surface-muted)',
                                      color: 'var(--pd-muted)',
                                      borderRadius: 'var(--pd-radius-pill)',
                                    }}
                                  >
                                    {getRoleName(substitution.shifts.role)}
                                  </span>
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold"
                                    style={{
                                      background: meta.bg,
                                      color: meta.color,
                                      borderRadius: 'var(--pd-radius-pill)',
                                    }}
                                  >
                                    <StatusIcon className="h-3 w-3" />
                                    {meta.label}
                                  </span>
                                </div>

                                <div
                                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                                  style={{ color: 'var(--pd-muted)' }}
                                >
                                  <span
                                    className="inline-flex items-center gap-1.5 tabular-nums"
                                    style={{ color: 'var(--pd-text)' }}
                                  >
                                    <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--pd-muted)' }} />
                                    {substitution.shifts.startTime}–{substitution.shifts.endTime}
                                  </span>
                                  <span>
                                    Richiede{' '}
                                    <strong style={{ color: 'var(--pd-text)' }}>
                                      {formatUsername(substitution.requester.username)}
                                    </strong>
                                  </span>
                                  <span>
                                    {substitution.substitute ? (
                                      <>
                                        Sostituto{' '}
                                        <strong style={{ color: 'var(--pd-text)' }}>
                                          {formatUsername(substitution.substitute.username)}
                                        </strong>
                                      </>
                                    ) : (
                                      'In attesa di candidato'
                                    )}
                                  </span>
                                  <span className="tabular-nums">
                                    {format(parseISO(substitution.createdAt), 'dd MMM, HH:mm', {
                                      locale: it,
                                    })}
                                  </span>
                                </div>

                                {substitution.requestNote ? (
                                  <p className="text-[11px] truncate" style={{ color: 'var(--pd-muted)' }}>
                                    Motivo: {substitution.requestNote}
                                  </p>
                                ) : null}

                                {substitution.responseNote ? (
                                  <p className="text-[11px]" style={{ color: 'var(--pd-danger)' }}>
                                    Rifiuto: {substitution.responseNote}
                                  </p>
                                ) : null}
                              </div>

                              {(canApprove || canReject) && (
                                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                                  {canReject && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedSubstitution(substitution)
                                        setShowRejectModal(true)
                                      }}
                                      disabled={processingId === substitution.id}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold pd-press disabled:opacity-50"
                                      style={{
                                        color: 'var(--pd-danger)',
                                        background: 'var(--pd-danger-soft)',
                                        borderRadius: 'var(--pd-radius)',
                                      }}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      Rifiuta
                                    </button>
                                  )}
                                  {canApprove && (
                                    <button
                                      type="button"
                                      onClick={() => approveSubstitution(substitution.id)}
                                      disabled={processingId === substitution.id}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold pd-btn-primary disabled:opacity-50"
                                    >
                                      {processingId === substitution.id ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                      Approva
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
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
