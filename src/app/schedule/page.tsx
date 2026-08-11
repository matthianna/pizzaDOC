'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { ListRow, EmptyState } from '@/components/ui/list-row'
import { WeekNavigator } from '@/components/ui/week-navigator'
import { Clock, Users, AlertCircle } from 'lucide-react'
import { isPast } from 'date-fns'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import {
  getWeekStart,
  getWeekDays,
  addWeekCalendarDays,
  formatDate,
  formatMonthYearIt,
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

const SUB_STATUS: Record<string, string> = {
  PENDING: 'In attesa',
  APPLIED: 'Candidature',
  APPROVED: 'Approvato',
  REJECTED: 'Rifiutato',
  CANCELLED: 'Annullato',
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
          setCurrentWeek(prev =>
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
    setCurrentWeek(prev => addWeekCalendarDays(prev, -7))
  }

  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeekCalendarDays(prev, 7))
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
          requestNote: requestNote.trim()
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

  const shiftsByDay = shifts.reduce((acc, shift) => {
    const day = shift.dayOfWeek
    if (!acc[day]) acc[day] = []
    acc[day].push(shift)
    return acc
  }, {} as Record<number, Shift[]>)

  const isShiftEnded = (shift: Shift) => {
    const now = new Date()
    const currentTime = now.getHours()
    const shiftDate = addWeekCalendarDays(currentWeek, shift.dayOfWeek)

    if (utcCalendarDateKey(shiftDate) !== appTodayCalendarDateKey()) {
      return isPast(shiftDate)
    }

    return (shift.shiftType === 'PRANZO' && currentTime >= 14) ||
      (shift.shiftType === 'CENA' && currentTime >= 22)
  }

  const needsHoursEntry = (shift: Shift) => {
    return isShiftEnded(shift) && !shift.workedHours
  }

  if (!session) {
    return <div>Caricamento...</div>
  }

  return (
    <MainLayout contentWidth="4xl" title="Mio piano" subtitle="I tuoi turni della settimana">
      <div className="pd-page pb-20">
        <PageHeader
          title="Mio piano"
          subtitle="I tuoi turni della settimana"
        />

        <PersonalCalendarSubscribe />

        <WeekNavigator
          label={`${formatDate(currentWeek)} – ${formatDate(weekEnd)}`}
          hint={formatMonthYearIt(currentWeek)}
          onPrev={goToPreviousWeek}
          onNext={goToNextWeek}
          onToday={goToCurrentWeek}
          disabled={loading}
        />

        {shifts.length > 0 && (
          <StatStrip
            items={[
              { label: 'Turni', value: shifts.length },
              { label: 'Pranzo', value: shifts.filter(s => s.shiftType === 'PRANZO').length },
              { label: 'Cena', value: shifts.filter(s => s.shiftType === 'CENA').length },
            ]}
          />
        )}

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--pd-muted)' }}>
            Caricamento turni…
          </div>
        ) : shifts.length === 0 ? (
          <SectionBlock card>
            <EmptyState
              title="Nessun turno questa settimana"
              description="Quando ti verranno assegnati turni, li vedrai qui giorno per giorno."
            />
          </SectionBlock>
        ) : (
          <div className="space-y-6">
            {days.map((day, dayIndex) => {
              const dayShifts = shiftsByDay[dayIndex] || []
              if (dayShifts.length === 0) return null

              const columnIsToday =
                utcCalendarDateKey(day) === appTodayCalendarDateKey()

              return (
                <SectionBlock
                  key={dayIndex}
                  title={`${shortWeekdayItFromDate(day)} ${String(day.getUTCDate()).padStart(2, '0')}`}
                  subtitle={columnIsToday ? 'Oggi' : formatMonthYearIt(day)}
                  card
                >
                  {dayShifts.map((shift) => {
                    const shiftDate = addWeekCalendarDays(currentWeek, shift.dayOfWeek)
                    const [startHour, startMinute] = shift.startTime.split(':').map(Number)
                    const shiftStartDateTime = new Date(shiftDate)
                    shiftStartDateTime.setHours(startHour, startMinute, 0, 0)

                    const isFutureShift = !isPast(shiftStartDateTime)
                    const shiftEnded = isShiftEnded(shift)
                    const needsHours = needsHoursEntry(shift)
                    const existingSubstitution = substitutions.find(sub => sub.shiftId === shift.id)

                    let meta: string = shift.startTime
                    if (shiftEnded) meta = 'Finito'
                    else if (shift.workedHours) {
                      meta = formatDecimalHoursIt(shift.workedHours.totalHours)
                    }

                    return (
                      <div key={shift.id}>
                        <ListRow
                          title={getShiftTypeName(shift.shiftType)}
                          subtitle={`${getRoleName(shift.role)} · ${shift.startTime}`}
                          meta={meta}
                          highlight={columnIsToday && !shiftEnded}
                          trailing={
                            needsHours ? (
                              <a
                                href="/hours"
                                className="text-xs font-semibold inline-flex items-center gap-1"
                                style={{ color: 'var(--pd-warning)' }}
                              >
                                <AlertCircle className="h-3.5 w-3.5" />
                                Ore
                              </a>
                            ) : shift.workedHours ? (
                              <span
                                className="text-[11px] font-medium"
                                style={{ color: 'var(--pd-muted)' }}
                              >
                                {shift.workedHours.status === 'PENDING' && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> In attesa
                                  </span>
                                )}
                                {shift.workedHours.status === 'APPROVED' && 'Approvato'}
                                {shift.workedHours.status === 'REJECTED' && 'Rifiutato'}
                              </span>
                            ) : null
                          }
                        />
                        {isFutureShift && !shiftEnded && (
                          <div
                            className="px-4 py-2 flex justify-end"
                            style={{ borderBottom: '1px solid var(--pd-border)' }}
                          >
                            {existingSubstitution ? (
                              <span className="text-xs font-medium" style={{ color: 'var(--pd-muted)' }}>
                                Sostituzione: {SUB_STATUS[existingSubstitution.status] || 'In attesa'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openSubstitutionModal(shift)}
                                className="text-xs font-semibold inline-flex items-center gap-1.5 pd-press"
                                style={{ color: 'var(--pd-accent)' }}
                              >
                                <Users className="h-3.5 w-3.5" />
                                Cerca sostituto
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </SectionBlock>
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
          maxWidth="sm"
        >
          {selectedShift && (
            <div className="space-y-4">
              <div
                className="p-3 rounded-[var(--pd-radius)]"
                style={{
                  background: 'var(--pd-accent-soft)',
                  border: '1px solid var(--pd-border)',
                }}
              >
                <div className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                  {getDayName(selectedShift.dayOfWeek)} - {getShiftTypeName(selectedShift.shiftType)}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--pd-muted)' }}>
                  {formatDate(addWeekCalendarDays(currentWeek, selectedShift.dayOfWeek))}
                </div>
                <div className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                  {selectedShift.startTime} · {getRoleName(selectedShift.role)}
                </div>
              </div>

              <Input
                label="Motivo della richiesta"
                placeholder="Spiega perché hai bisogno di un sostituto..."
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                multiline
                rows={3}
              />

              <div className="flex justify-end gap-3 pt-2">
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
                  Crea richiesta
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
