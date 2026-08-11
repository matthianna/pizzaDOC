'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { ListRow, EmptyState } from '@/components/ui/list-row'
import { CheckCircle, Send, Trash2 } from 'lucide-react'
import { format, isPast } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { addWeekCalendarDays } from '@/lib/date-utils'
import { Role, ShiftType, SubstitutionStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useHaptics } from '@/hooks/use-haptics'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

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

interface UserType {
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
  deadline: string
  createdAt: string
  shifts: Shift
  requester: UserType
  substitute?: UserType
}

export default function SubstitutionRequestsPage() {
  const { data: session } = useSession()
  const [availableSubstitutions, setAvailableSubstitutions] = useState<Substitution[]>([])
  const [myRequests, setMyRequests] = useState<Substitution[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedSubstitutionToCancel, setSelectedSubstitutionToCancel] = useState<Substitution | null>(null)
  const { showToast, ToastContainer } = useToast()
  const { lightClick, success, mediumClick } = useHaptics()

  useEffect(() => {
    if (session?.user?.id) {
      fetchSubstitutions()
    }
  }, [session?.user?.id])

  const fetchSubstitutions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/user/substitutions')
      if (response.ok) {
        const data = await response.json()
        setAvailableSubstitutions(data.available)
        setMyRequests(data.mine)
      }
    } catch (error) {
      console.error('Error fetching substitutions:', error)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyForSubstitution = async (substitutionId: string) => {
    lightClick()
    setApplying(substitutionId)
    try {
      const response = await fetch(`/api/user/substitutions/${substitutionId}/apply`, {
        method: 'POST',
      })

      if (response.ok) {
        success()
        showToast('Ti sei candidato con successo!', 'success')
        fetchSubstitutions()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nella candidatura', 'error')
      }
    } catch (error) {
      console.error('Error applying for substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setApplying(null)
    }
  }

  const openCancelModal = (substitution: Substitution) => {
    setSelectedSubstitutionToCancel(substitution)
    setShowCancelModal(true)
  }

  const closeCancelModal = () => {
    setShowCancelModal(false)
    setSelectedSubstitutionToCancel(null)
  }

  const approveSubstitution = async (substitutionId: string) => {
    lightClick()
    setApproving(substitutionId)
    try {
      const response = await fetch(`/api/user/substitutions/${substitutionId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ responseNote: null }),
      })

      if (response.ok) {
        success()
        showToast('Sostituzione approvata con successo!', 'success')
        fetchSubstitutions()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'approvazione', 'error')
      }
    } catch (error) {
      console.error('Error approving substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setApproving(null)
    }
  }

  const confirmCancelSubstitution = async () => {
    if (!selectedSubstitutionToCancel) return

    mediumClick()
    setCancelling(selectedSubstitutionToCancel.id)
    try {
      const response = await fetch(`/api/user/substitutions/${selectedSubstitutionToCancel.id}/cancel`, {
        method: 'POST',
      })

      if (response.ok) {
        showToast('Richiesta di sostituzione annullata con successo', 'success')
        fetchSubstitutions()
        return
      }

      const error = await response.json().catch(() => ({} as { error?: string }))
      showToast(error.error || 'Errore nell\'annullamento', 'error')
      throw new Error('CANCEL_FAILED')
    } catch (error) {
      console.error('Error cancelling substitution:', error)
      if (!(error instanceof Error && error.message === 'CANCEL_FAILED')) {
        showToast('Errore di connessione', 'error')
      }
      throw error
    } finally {
      setCancelling(null)
    }
  }

  const getShiftDate = (shift: Shift) => {
    const weekStart = new Date(shift.schedules.weekStart)
    return addWeekCalendarDays(weekStart, shift.dayOfWeek)
  }

  const getStatusText = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING': return 'In attesa'
      case 'APPLIED': return 'Candidato trovato'
      case 'APPROVED': return 'Approvata'
      case 'REJECTED': return 'Rifiutata'
      case 'EXPIRED': return 'Scaduta'
      case 'CANCELLED': return 'Annullata'
      default: return status
    }
  }

  const getStatusColor = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING': return 'var(--pd-warning)'
      case 'APPLIED': return 'var(--pd-accent)'
      case 'APPROVED': return 'var(--pd-success)'
      case 'REJECTED': return 'var(--pd-danger)'
      default: return 'var(--pd-muted)'
    }
  }

  if (!session) return <LoadingSpinner fullScreen text="Caricamento..." />

  return (
    <MainLayout contentWidth="4xl" title="Sostituzioni" subtitle="Coperture e candidature">
      <div className="pd-page pb-20">
        <PageHeader
          title="Sostituzioni"
          subtitle="Trova una copertura o offriti per un turno"
        />

        {!loading && (
          <StatStrip
            items={[
              { label: 'Disponibili', value: availableSubstitutions.length },
              { label: 'Le mie', value: myRequests.length },
            ]}
          />
        )}

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--pd-muted)' }}>
            Caricamento…
          </div>
        ) : (
          <div className="space-y-6">
            <SectionBlock title="Richieste disponibili" card>
              {availableSubstitutions.length === 0 ? (
                <EmptyState title="Nessuna richiesta disponibile" />
              ) : (
                availableSubstitutions.map(substitution => {
                  const shiftDate = getShiftDate(substitution.shifts)
                  const [startHour, startMinute] = substitution.shifts.startTime.split(':').map(Number)
                  const shiftStartDateTime = new Date(shiftDate)
                  shiftStartDateTime.setHours(startHour, startMinute, 0, 0)
                  const canApply = substitution.status === 'PENDING' && !isPast(shiftStartDateTime)
                  const isAlreadyApplied = substitution.substitute?.id === session.user.id

                  return (
                    <div key={substitution.id}>
                      <ListRow
                        title={`${getDayName(substitution.shifts.dayOfWeek)} · ${getShiftTypeName(substitution.shifts.shiftType)}`}
                        subtitle={`${format(shiftDate, 'd MMMM yyyy', { locale: it })} · ${substitution.shifts.startTime} · ${getRoleName(substitution.shifts.role)} · ${substitution.requester.username}`}
                        trailing={
                          <span
                            className="inline-flex px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              color: getStatusColor(substitution.status),
                              background: 'var(--pd-surface-muted)',
                              borderRadius: 'var(--pd-radius-pill)',
                            }}
                          >
                            {getStatusText(substitution.status)}
                          </span>
                        }
                      />
                      {substitution.requestNote && (
                        <p
                          className="px-4 pb-2 text-xs italic"
                          style={{ color: 'var(--pd-muted)', borderBottom: '1px solid var(--pd-border)' }}
                        >
                          “{substitution.requestNote}”
                        </p>
                      )}
                      {(canApply && !isAlreadyApplied) || isAlreadyApplied ? (
                        <div
                          className="px-4 py-3"
                          style={{ borderBottom: '1px solid var(--pd-border)' }}
                        >
                          {canApply && !isAlreadyApplied && (
                            <Button
                              onClick={() => applyForSubstitution(substitution.id)}
                              disabled={applying === substitution.id}
                              isLoading={applying === substitution.id}
                              className="w-full py-3 pd-btn-primary text-sm"
                            >
                              <Send className="h-4 w-4 mr-2" /> Candidati
                            </Button>
                          )}
                          {isAlreadyApplied && (
                            <p className="text-center text-xs font-semibold" style={{ color: 'var(--pd-success)' }}>
                              Candidatura inviata
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </SectionBlock>

            <SectionBlock title="Le mie richieste" card>
              {myRequests.length === 0 ? (
                <EmptyState title="Non hai richieste attive" />
              ) : (
                myRequests.map(substitution => {
                  const shiftDate = getShiftDate(substitution.shifts)
                  return (
                    <div key={substitution.id}>
                      <ListRow
                        title={`${getDayName(substitution.shifts.dayOfWeek)} · ${getShiftTypeName(substitution.shifts.shiftType)}`}
                        subtitle={`${format(shiftDate, 'd MMMM yyyy', { locale: it })} · ${substitution.shifts.startTime}${
                          substitution.substitute
                            ? ` · Candidato: ${substitution.substitute.username}`
                            : ''
                        }`}
                        trailing={
                          <span
                            className="inline-flex px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              color: getStatusColor(substitution.status),
                              background: 'var(--pd-surface-muted)',
                              borderRadius: 'var(--pd-radius-pill)',
                            }}
                          >
                            {getStatusText(substitution.status)}
                          </span>
                        }
                      />
                      {substitution.requestNote && (
                        <p
                          className="px-4 pb-2 text-xs italic"
                          style={{ color: 'var(--pd-muted)', borderBottom: '1px solid var(--pd-border)' }}
                        >
                          “{substitution.requestNote}”
                        </p>
                      )}
                      {((substitution.substitute && substitution.status === 'APPLIED') ||
                        (['PENDING', 'APPLIED'].includes(substitution.status) &&
                          (!substitution.substitute || substitution.status === 'PENDING'))) && (
                        <div
                          className="px-4 py-3 space-y-2"
                          style={{ borderBottom: '1px solid var(--pd-border)' }}
                        >
                          {substitution.substitute && substitution.status === 'APPLIED' && (
                            <button
                              type="button"
                              onClick={() => approveSubstitution(substitution.id)}
                              disabled={approving === substitution.id}
                              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold pd-press disabled:opacity-50"
                              style={{
                                background: 'var(--pd-success)',
                                color: 'var(--pd-accent-fg)',
                                borderRadius: 'var(--pd-radius)',
                              }}
                            >
                              {approving === substitution.id ? (
                                'Approvazione…'
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" /> Approva candidatura
                                </>
                              )}
                            </button>
                          )}
                          {['PENDING', 'APPLIED'].includes(substitution.status) &&
                            (!substitution.substitute || substitution.status === 'PENDING') && (
                              <button
                                type="button"
                                onClick={() => openCancelModal(substitution)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold pd-press"
                                style={{
                                  color: 'var(--pd-danger)',
                                  background: 'var(--pd-surface-muted)',
                                  borderRadius: 'var(--pd-radius)',
                                }}
                              >
                                <Trash2 className="h-4 w-4" /> Annulla richiesta
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </SectionBlock>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showCancelModal && !!selectedSubstitutionToCancel}
        onClose={closeCancelModal}
        onConfirm={confirmCancelSubstitution}
        title="Annulla richiesta"
        description={
          selectedSubstitutionToCancel
            ? `Annullare la richiesta per ${getDayName(selectedSubstitutionToCancel.shifts.dayOfWeek)} ${getShiftTypeName(selectedSubstitutionToCancel.shifts.shiftType)} del ${format(getShiftDate(selectedSubstitutionToCancel.shifts), 'dd MMMM yyyy', { locale: it })}? Questa azione è irreversibile.`
            : 'Questa azione è irreversibile.'
        }
        confirmLabel={cancelling ? 'Annullamento…' : 'Conferma'}
        cancelLabel="Indietro"
        isDangerous
        isLoading={!!cancelling}
      />

      <ToastContainer />
    </MainLayout>
  )
}
