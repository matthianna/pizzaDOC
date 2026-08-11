'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState } from '@/components/ui/list-row'
import { WeekNavigator } from '@/components/ui/week-navigator'
import { Clock, Users, AlertCircle, Sun, Moon, CheckCircle2 } from 'lucide-react'
import { isPast } from 'date-fns'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import {
  getWeekStart,
  getWeekDays,
  addWeekCalendarDays,
  formatDate,
  formatMonthYearIt,
  formatDayMonthIt,
  shortWeekdayItFromDate,
  utcCalendarDateKey,
  appTodayCalendarDateKey,
} from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'
import { Role, ShiftType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PersonalCalendarSubscribe } from '@/components/schedule/personal-calendar-subscribe'

interface Substitution {
  id: string
  shiftId: string
  status: 'PENDING' | 'APPLIED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  substitute?: {
    username: string
  }
}

interface Shift {
  id: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  schedule: {
    weekStart: string
  }
  workedHours?: {
    id: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    totalHours: number
  }
}

const SUB_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'In attesa', color: 'var(--pd-warning)', bg: 'var(--pd-warning-soft)' },
  APPLIED: { label: 'Candidature', color: 'var(--pd-accent)', bg: 'var(--pd-accent-soft)' },
  APPROVED: { label: 'Approvata', color: 'var(--pd-success)', bg: 'var(--pd-success-soft)' },
  REJECTED: { label: 'Rifiutata', color: 'var(--pd-danger)', bg: 'var(--pd-danger-soft)' },
  CANCELLED: { label: 'Annullata', color: 'var(--pd-muted)', bg: 'var(--pd-surface-muted)' },
}

function timeLabel(t: string) {
  return typeof t === 'string' ? t.slice(0, 5) : t
}

export default function SchedulePage() {
  const { data: session } = useSession()
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [substitutions, setSubstitutions] = useState<Substitution[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [requestNote, setRequestNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    if (session?.user?.id) {
      fetchMyShifts()
      fetchSubstitutions()
    }
  }, [session?.user?.id, currentWeek])

  const fetchMyShifts = async () => {
    setLoading(true)
    try {
      const weekStart = currentWeek.toISOString()
      const response = await fetch(`/api/user/schedule?weekStart=${encodeURIComponent(weekStart)}`, {
        cache: 'no-store',
      })

      if (response.ok) {
        const body = await response.json()
        const shiftsData = body.shifts ?? []
        if (body.weekStart) {
          const normalized = normalizeDate(body.weekStart)
          setCurrentWeek((prev) =>
            prev.getTime() === normalized.getTime() ? prev : normalized
          )
        }
        setShifts(shiftsData)
      }
    } catch (error) {
      console.error('Error fetching shifts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSubstitutions = async () => {
    try {
      const response = await fetch('/api/user/substitutions')
      if (response.ok) {
        const data = await response.json()
        setSubstitutions(data.mine || [])
      }
    } catch (error) {
      console.error('Error fetching substitutions:', error)
    }
  }

  const goToPreviousWeek = () => {
    setCurrentWeek((prev) => addWeekCalendarDays(prev, -7))
  }

  const goToNextWeek = () => {
    setCurrentWeek((prev) => addWeekCalendarDays(prev, 7))
  }

  const goToCurrentWeek = () => {
    setCurrentWeek(getWeekStart(new Date()))
  }

  const openSubstitutionModal = (shift: Shift) => {
    setSelectedShift(shift)
    setShowSubstitutionModal(true)
    setRequestNote('')
  }

  const createSubstitutionRequest = async () => {
    if (!selectedShift || !requestNote.trim()) {
      showToast('Inserisci il motivo della richiesta', 'error')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/user/substitutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shiftId: selectedShift.id,
          requestNote: requestNote.trim(),
        }),
      })

      if (response.ok) {
        showToast('Richiesta per sostituto creata!', 'success')
        setShowSubstitutionModal(false)
        setSelectedShift(null)
        setRequestNote('')
        fetchMyShifts()
        fetchSubstitutions()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nella creazione', 'error')
      }
    } catch (error) {
      console.error('Error creating substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const weekEnd = addWeekCalendarDays(currentWeek, 6)
  const days = getWeekDays(currentWeek)

  const shiftsByDay = shifts.reduce(
    (acc, shift) => {
      const day = shift.dayOfWeek
      if (!acc[day]) acc[day] = []
      acc[day].push(shift)
      return acc
    },
    {} as Record<number, Shift[]>
  )

  const isShiftEnded = (shift: Shift) => {
    const now = new Date()
    const currentTime = now.getHours()
    const shiftDate = addWeekCalendarDays(currentWeek, shift.dayOfWeek)

    if (utcCalendarDateKey(shiftDate) !== appTodayCalendarDateKey()) {
      return isPast(shiftDate)
    }

    return (
      (shift.shiftType === 'PRANZO' && currentTime >= 14) ||
      (shift.shiftType === 'CENA' && currentTime >= 22)
    )
  }

  const needsHoursEntry = (shift: Shift) => {
    return isShiftEnded(shift) && !shift.workedHours
  }

  if (!session) {
    return <LoadingSpinner fullScreen text="Caricamento..." />
  }

  return (
    <MainLayout contentWidth="4xl" title="Mio piano" subtitle="I tuoi turni della settimana">
      <div className="pd-page pb-20">
        <PageHeader dense title="Mio piano" subtitle="I tuoi turni della settimana" />

        <PersonalCalendarSubscribe />

        <WeekNavigator
          label={`${formatDayMonthIt(currentWeek)} – ${formatDate(weekEnd)}`}
          hint={
            !loading && shifts.length > 0
              ? `${shifts.length} ${shifts.length === 1 ? 'turno' : 'turni'} questa settimana`
              : formatMonthYearIt(currentWeek)
          }
          onPrev={goToPreviousWeek}
          onNext={goToNextWeek}
          onToday={goToCurrentWeek}
          disabled={loading}
        />

        {shifts.length > 0 && (
          <StatStrip
            items={[
              { label: 'Turni', value: shifts.length },
              { label: 'Pranzo', value: shifts.filter((s) => s.shiftType === 'PRANZO').length },
              { label: 'Cena', value: shifts.filter((s) => s.shiftType === 'CENA').length },
            ]}
          />
        )}

        {loading ? (
          <div className="py-16 flex justify-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
              style={{ borderColor: 'var(--pd-accent)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : shifts.length === 0 ? (
          <SectionBlock card>
            <EmptyState
              title="Nessun turno questa settimana"
              description="Quando ti verranno assegnati turni, li vedrai qui giorno per giorno."
            />
          </SectionBlock>
        ) : (
          <div className="space-y-4">
            {days.map((day, dayIndex) => {
              const dayShifts = shiftsByDay[dayIndex] || []
              if (dayShifts.length === 0) return null

              const columnIsToday = utcCalendarDateKey(day) === appTodayCalendarDateKey()

              return (
                <section
                  key={dayIndex}
                  className="overflow-hidden"
                  style={{
                    background: 'var(--pd-surface)',
                    border: columnIsToday
                      ? '1px solid color-mix(in srgb, var(--pd-accent) 35%, var(--pd-border))'
                      : '1px solid var(--pd-border)',
                    borderRadius: 'var(--pd-radius-lg)',
                    boxShadow: 'var(--pd-shadow)',
                  }}
                >
                  <div
                    className="px-4 py-3 flex items-center justify-between gap-3"
                    style={{
                      background: columnIsToday
                        ? 'color-mix(in srgb, var(--pd-accent-soft) 70%, var(--pd-surface))'
                        : 'var(--pd-surface-muted)',
                      borderBottom: '1px solid var(--pd-border)',
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                        {shortWeekdayItFromDate(day)} {formatDayMonthIt(day)}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                        {dayShifts.length} {dayShifts.length === 1 ? 'turno' : 'turni'}
                      </p>
                    </div>
                    {columnIsToday && (
                      <span
                        className="text-[11px] font-semibold px-2.5 py-1"
                        style={{
                          color: 'var(--pd-accent)',
                          background: 'var(--pd-surface)',
                          borderRadius: 'var(--pd-radius-pill)',
                          border: '1px solid color-mix(in srgb, var(--pd-accent) 30%, var(--pd-border))',
                        }}
                      >
                        Oggi
                      </span>
                    )}
                  </div>

                  <div className="divide-y" style={{ borderColor: 'var(--pd-border)' }}>
                    {dayShifts.map((shift) => {
                      const shiftDate = addWeekCalendarDays(currentWeek, shift.dayOfWeek)
                      const [startHour, startMinute] = shift.startTime.split(':').map(Number)
                      const shiftStartDateTime = new Date(shiftDate)
                      shiftStartDateTime.setHours(startHour, startMinute, 0, 0)

                      const isFutureShift = !isPast(shiftStartDateTime)
                      const shiftEnded = isShiftEnded(shift)
                      const needsHours = needsHoursEntry(shift)
                      const existingSubstitution = substitutions.find(
                        (sub) => sub.shiftId === shift.id
                      )
                      const isPranzo = shift.shiftType === 'PRANZO'
                      const ShiftIcon = isPranzo ? Sun : Moon
                      const subMeta = existingSubstitution
                        ? SUB_STATUS[existingSubstitution.status]
                        : null

                      return (
                        <div
                          key={shift.id}
                          className="px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
                          style={{
                            background:
                              columnIsToday && !shiftEnded
                                ? 'color-mix(in srgb, var(--pd-accent-soft) 35%, transparent)'
                                : undefined,
                          }}
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div
                              className="w-10 h-10 shrink-0 flex items-center justify-center"
                              style={{
                                background: isPranzo
                                  ? 'var(--pd-warning-soft)'
                                  : 'var(--pd-surface-muted)',
                                color: isPranzo ? 'var(--pd-warning)' : 'var(--pd-muted)',
                                borderRadius: 'var(--pd-radius)',
                              }}
                            >
                              <ShiftIcon className="h-5 w-5" />
                            </div>

                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                                  {getShiftTypeName(shift.shiftType)}
                                </p>
                                <span
                                  className="inline-flex px-2 py-0.5 text-[11px] font-medium"
                                  style={{
                                    background: 'var(--pd-surface-muted)',
                                    color: 'var(--pd-muted)',
                                    borderRadius: 'var(--pd-radius-pill)',
                                  }}
                                >
                                  {getRoleName(shift.role)}
                                </span>
                                {shiftEnded && (
                                  <span
                                    className="inline-flex px-2 py-0.5 text-[11px] font-semibold"
                                    style={{
                                      background: 'var(--pd-surface-muted)',
                                      color: 'var(--pd-muted)',
                                      borderRadius: 'var(--pd-radius-pill)',
                                    }}
                                  >
                                    Finito
                                  </span>
                                )}
                              </div>

                              <p
                                className="text-sm font-semibold tabular-nums"
                                style={{ color: 'var(--pd-text)' }}
                              >
                                {timeLabel(shift.startTime)}
                                {shift.endTime ? (
                                  <span style={{ color: 'var(--pd-muted)' }}>
                                    –{timeLabel(shift.endTime)}
                                  </span>
                                ) : null}
                              </p>

                              {shift.workedHours && (
                                <p className="text-[11px]" style={{ color: 'var(--pd-muted)' }}>
                                  Ore:{' '}
                                  <strong style={{ color: 'var(--pd-text)' }}>
                                    {formatDecimalHoursIt(shift.workedHours.totalHours)}
                                  </strong>
                                  {shift.workedHours.status === 'PENDING' && ' · in attesa'}
                                  {shift.workedHours.status === 'APPROVED' && ' · approvate'}
                                  {shift.workedHours.status === 'REJECTED' && ' · rifiutate'}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
                            {needsHours && (
                              <a
                                href="/hours"
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold pd-press"
                                style={{
                                  color: 'var(--pd-warning)',
                                  background: 'var(--pd-warning-soft)',
                                  borderRadius: 'var(--pd-radius)',
                                }}
                              >
                                <AlertCircle className="h-3.5 w-3.5" />
                                Inserisci ore
                              </a>
                            )}

                            {isFutureShift && !shiftEnded && (
                              <>
                                {existingSubstitution && subMeta ? (
                                  <span
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
                                    style={{
                                      color: subMeta.color,
                                      background: subMeta.bg,
                                      borderRadius: 'var(--pd-radius)',
                                    }}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Sostituzione: {subMeta.label}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openSubstitutionModal(shift)}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold pd-press"
                                    style={{
                                      color: 'var(--pd-accent)',
                                      background: 'var(--pd-accent-soft)',
                                      border: '1px solid color-mix(in srgb, var(--pd-accent) 28%, transparent)',
                                      borderRadius: 'var(--pd-radius-pill)',
                                    }}
                                  >
                                    <Users className="h-4 w-4" />
                                    Cerca sostituto
                                  </button>
                                )}
                              </>
                            )}

                            {shift.workedHours?.status === 'PENDING' && !needsHours && (
                              <span
                                className="inline-flex items-center gap-1.5 text-[11px] font-medium"
                                style={{ color: 'var(--pd-muted)' }}
                              >
                                <Clock className="h-3.5 w-3.5" />
                                Ore in attesa
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <Modal
          isOpen={showSubstitutionModal && !!selectedShift}
          onClose={() => {
            setShowSubstitutionModal(false)
            setSelectedShift(null)
            setRequestNote('')
          }}
          title="Cerca un sostituto"
          subtitle="Invia una richiesta di sostituzione"
          headerIcon={<Users className="h-6 w-6" />}
          maxWidth="sm"
        >
          {selectedShift && (
            <div className="space-y-4 pt-1">
              <div
                className="p-3.5"
                style={{
                  background: 'var(--pd-accent-soft)',
                  border: '1px solid color-mix(in srgb, var(--pd-accent) 25%, var(--pd-border))',
                  borderRadius: 'var(--pd-radius)',
                }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                  {getDayName(selectedShift.dayOfWeek)} ·{' '}
                  {getShiftTypeName(selectedShift.shiftType)}
                </p>
                <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--pd-muted)' }}>
                  {formatDate(addWeekCalendarDays(currentWeek, selectedShift.dayOfWeek))} ·{' '}
                  {timeLabel(selectedShift.startTime)}
                  {selectedShift.endTime ? `–${timeLabel(selectedShift.endTime)}` : ''} ·{' '}
                  {getRoleName(selectedShift.role)}
                </p>
              </div>

              <Input
                label="Motivo della richiesta"
                placeholder="Es. imprevisto, visita medica, personale…"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                multiline
                rows={3}
              />

              <div className="flex justify-end gap-2.5 pt-1">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSubstitutionModal(false)
                    setSelectedShift(null)
                    setRequestNote('')
                  }}
                >
                  Annulla
                </Button>
                <Button
                  onClick={createSubstitutionRequest}
                  disabled={!requestNote.trim() || submitting}
                  isLoading={submitting}
                >
                  Invia richiesta
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
