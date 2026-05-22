'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import {
  Bike,
  Car,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { formatVehicleUsageLabel, getShiftTypeName, cn } from '@/lib/utils'
import {
  getWeekStart,
  addWeekCalendarDays,
  formatMonthYearIt,
  shiftCalendarDateUtc,
  appTodayCalendarDateKey,
  utcCalendarDateKey,
} from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'
import { ShiftType } from '@prisma/client'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { useHaptics } from '@/hooks/use-haptics'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

interface ScooterUsage {
  id: string
  scooterNumber: number | null
  usedAuto: boolean
  recordedAt: string
}

interface ShiftRow {
  id: string
  dayOfWeek: number
  shiftType: ShiftType
  role: string
  startTime: string
  endTime: string
  requiresScooterLog: boolean
  isEnded: boolean
  shiftDate: string
  scooterUsage: ScooterUsage | null
}

function shiftTypeStyles(shiftType: ShiftType, ended: boolean) {
  if (ended) return 'from-gray-100 to-gray-50 border-gray-200 text-gray-700'
  if (shiftType === 'PRANZO') return 'from-amber-50 to-orange-50 border-amber-200 text-amber-900'
  return 'from-blue-50 to-indigo-50 border-blue-200 text-blue-900'
}

export default function ScooterUsagePage() {
  const { data: session } = useSession()
  const [currentWeek] = useState(() => getWeekStart(new Date()))
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [eligible, setEligible] = useState(true)
  const [loading, setLoading] = useState(true)
  const [maxScooters, setMaxScooters] = useState(4)
  const [registrationStart, setRegistrationStart] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<ShiftRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()
  const { lightClick } = useHaptics()

  const todayKey = appTodayCalendarDateKey()

  useEffect(() => {
    if (session?.user?.id) fetchData()
  }, [session?.user?.id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/user/scooter-usage?weekStart=${encodeURIComponent(currentWeek.toISOString())}`,
        { cache: 'no-store' }
      )
      if (!res.ok) {
        showToast('Errore nel caricamento', 'error')
        return
      }
      const data = await res.json()
      setEligible(data.eligible ?? true)
      setShifts(data.shifts ?? [])
      if (data.maxScooters) setMaxScooters(data.maxScooters)
      if (data.registrationStartDate) setRegistrationStart(data.registrationStartDate)
    } catch {
      showToast('Errore nel caricamento', 'error')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (shift: ShiftRow) => {
    lightClick()
    setSelectedShift(shift)
    setShowModal(true)
  }

  const saveUsage = async (payload: { scooterNumber?: number; usedAuto?: boolean }) => {
    if (!selectedShift) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/user/scooter-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: selectedShift.id, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Errore nel salvataggio', 'error')
        return
      }
      if (data.warning) showToast(data.warning, 'warning')
      else if (payload.usedAuto) showToast('Lavoro in auto registrato', 'success')
      else showToast(`Scooter ${payload.scooterNumber} registrato`, 'success')
      setShowModal(false)
      setSelectedShift(null)
      fetchData()
    } catch {
      showToast('Errore nel salvataggio', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const weekEnd = addWeekCalendarDays(currentWeek, 6)

  const { pending, registered, todayPending } = useMemo(() => {
    const p = shifts.filter((s) => s.requiresScooterLog && s.isEnded && !s.scooterUsage)
    const r = shifts.filter((s) => s.scooterUsage)
    const todayP = p.filter((s) => {
      const d = shiftCalendarDateUtc(currentWeek, s.dayOfWeek)
      return utcCalendarDateKey(d) === todayKey
    })
    return { pending: p, registered: r, todayPending: todayP }
  }, [shifts, currentWeek, todayKey])

  const formatShiftDate = (shift: ShiftRow) => {
    const d = shiftCalendarDateUtc(currentWeek, shift.dayOfWeek)
    return format(d, 'EEEE d MMMM', { locale: it })
  }

  const registrationStartLabel = registrationStart
    ? format(parseISO(`${registrationStart}T12:00:00.000Z`), 'd MMMM yyyy', { locale: it })
    : format(new Date(), 'd MMMM yyyy', { locale: it })

  if (!session) return null

  return (
    <MainLayout>
      <ToastContainer />
      <div className="max-w-lg mx-auto space-y-5 pb-24">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-sky-200/50">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-white/10 blur-xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Bike className="h-7 w-7" strokeWidth={2.5} />
              </div>
              {pending.length === 0 && eligible && !loading && (
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                  <Sparkles className="h-3 w-3" />
                  Tutto ok
                </span>
              )}
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight">Utilizzo scooter</h1>
            <p className="mt-2 text-sm font-medium text-sky-100 leading-relaxed">
              Registra scooter (1–{maxScooters}) o auto dopo ogni turno. Attivo dal{' '}
              <span className="text-white font-bold">{registrationStartLabel}</span>.
            </p>
          </div>
        </div>

        {!eligible && !loading && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-gray-600 font-medium text-sm">
              Non devi registrare l&apos;utilizzo scooter per il tuo profilo.
            </p>
          </div>
        )}

        {eligible && (
          <>
            {todayPending.length > 0 && (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 flex gap-3 items-start">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-amber-900 text-sm">Turno di oggi</p>
                  <p className="text-xs text-amber-800 mt-1 font-medium">
                    Hai {todayPending.length} registrazione da completare per oggi.
                  </p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-sky-200 border-t-sky-600" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Caricamento
                </p>
              </div>
            ) : (
              <>
                {/* Pending */}
                <section>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      </span>
                      Da registrare
                    </h2>
                    {pending.length > 0 && (
                      <span className="min-w-[1.5rem] h-6 px-2 flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-black">
                        {pending.length}
                      </span>
                    )}
                  </div>

                  {pending.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
                      <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-bold text-gray-700">Nessun turno in sospeso</p>
                      <p className="text-xs text-gray-500 mt-1">
                        I turni prima del {registrationStartLabel} non richiedono registrazione.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {pending.map((shift) => {
                        const isToday =
                          utcCalendarDateKey(shiftCalendarDateUtc(currentWeek, shift.dayOfWeek)) ===
                          todayKey
                        return (
                          <li key={shift.id}>
                            <button
                              type="button"
                              onClick={() => openModal(shift)}
                              className={cn(
                                'w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] shadow-sm',
                                isToday
                                  ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-white ring-2 ring-amber-200/60'
                                  : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md'
                              )}
                            >
                              {isToday && (
                                <span className="inline-block mb-2 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded-full">
                                  Oggi
                                </span>
                              )}
                              <p className="font-black text-gray-900 capitalize text-base leading-tight">
                                {formatShiftDate(shift)}
                              </p>
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <span
                                  className={cn(
                                    'text-xs font-black uppercase px-2.5 py-1 rounded-lg border',
                                    shiftTypeStyles(shift.shiftType, false)
                                  )}
                                >
                                  {getShiftTypeName(shift.shiftType)}
                                </span>
                                <span className="text-xs text-gray-500 font-bold flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {shift.startTime} – {shift.endTime}
                                </span>
                              </div>
                              <p className="mt-3 text-xs font-black text-sky-600 uppercase tracking-wide flex items-center gap-1">
                                Registra ora
                                <ChevronRight className="h-4 w-4" />
                              </p>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {/* Registered */}
                {registered.length > 0 && (
                  <section>
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3 px-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-100">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      </span>
                      Registrati
                    </h2>
                    <ul className="space-y-2">
                      {registered.map((shift) => {
                        const usedAuto = shift.scooterUsage!.usedAuto
                        return (
                          <li
                            key={shift.id}
                            className="rounded-2xl border border-green-200 bg-white p-4 flex items-center gap-3 shadow-sm"
                          >
                            <div
                              className={cn(
                                'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
                                usedAuto ? 'bg-gray-100' : 'bg-sky-100'
                              )}
                            >
                              {usedAuto ? (
                                <Car className="h-6 w-6 text-gray-700" />
                              ) : (
                                <span className="text-xl font-black text-sky-700">
                                  {shift.scooterUsage!.scooterNumber}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 capitalize text-sm truncate">
                                {formatShiftDate(shift)}
                              </p>
                              <p className="text-xs text-gray-500 font-medium">
                                {getShiftTypeName(shift.shiftType)} ·{' '}
                                <span className="text-green-700 font-black">
                                  {formatVehicleUsageLabel(shift.scooterUsage!)}
                                </span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openModal(shift)}
                              className="shrink-0 text-[10px] font-black uppercase tracking-wider text-sky-600 bg-sky-50 px-3 py-2 rounded-xl border border-sky-100"
                            >
                              Modifica
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                <p className="text-center text-[10px] text-gray-400 font-medium px-4">
                  Settimana {formatMonthYearIt(currentWeek)} ({currentWeek.getUTCDate()}–
                  {weekEnd.getUTCDate()})
                </p>
              </>
            )}
          </>
        )}

        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false)
            setSelectedShift(null)
          }}
          title="Come hai lavorato?"
          maxWidth="sm"
        >
          {selectedShift && (
            <div className="space-y-5 pb-2">
              <div className="text-center rounded-2xl bg-gray-50 border border-gray-100 py-4 px-3">
                <p className="text-base font-black text-gray-900 capitalize">
                  {formatShiftDate(selectedShift)}
                </p>
                <p className="text-sm text-gray-500 font-bold mt-1">
                  {getShiftTypeName(selectedShift.shiftType)} · {selectedShift.startTime} –{' '}
                  {selectedShift.endTime}
                </p>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => saveUsage({ usedAuto: true })}
                className={cn(
                  'w-full py-5 rounded-2xl font-black border-2 flex items-center justify-center gap-3 transition-all active:scale-[0.98]',
                  selectedShift.scooterUsage?.usedAuto
                    ? 'bg-gray-900 text-white border-gray-900 shadow-lg'
                    : 'bg-white text-gray-900 border-gray-200 hover:border-gray-400'
                )}
              >
                <Car className="h-6 w-6" />
                Ho lavorato in auto
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    oppure scooter
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  'grid gap-3',
                  maxScooters <= 3 ? 'grid-cols-3' : 'grid-cols-2'
                )}
              >
                {Array.from({ length: maxScooters }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={submitting}
                    onClick={() => saveUsage({ scooterNumber: n, usedAuto: false })}
                    className={cn(
                      'aspect-square rounded-2xl text-2xl sm:text-3xl font-black border-2 transition-all active:scale-95 flex flex-col items-center justify-center gap-1',
                      !selectedShift.scooterUsage?.usedAuto &&
                        selectedShift.scooterUsage?.scooterNumber === n
                        ? 'bg-sky-600 text-white border-sky-700 shadow-lg shadow-sky-200'
                        : 'bg-white text-gray-900 border-gray-200 hover:border-sky-400 hover:bg-sky-50'
                    )}
                  >
                    <Bike className="h-5 w-5 opacity-70" />
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  )
}
