'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Bike, Car, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatVehicleUsageLabel } from '@/lib/utils'
import {
  getWeekStart,
  addWeekCalendarDays,
  formatDate,
  formatMonthYearIt,
  shiftCalendarDateUtc,
} from '@/lib/date-utils'
import { getShiftTypeName } from '@/lib/utils'
import { normalizeDate } from '@/lib/normalize-date'
import { ShiftType } from '@prisma/client'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { useHaptics } from '@/hooks/use-haptics'
import { format } from 'date-fns'
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

export default function ScooterUsagePage() {
  const { data: session } = useSession()
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()))
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [eligible, setEligible] = useState(true)
  const [loading, setLoading] = useState(true)
  const [maxScooters, setMaxScooters] = useState(4)
  const [showModal, setShowModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<ShiftRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()
  const { lightClick } = useHaptics()

  useEffect(() => {
    if (session?.user?.id) fetchData()
  }, [session?.user?.id, currentWeek])

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
      if (data.weekStart) {
        const normalized = normalizeDate(data.weekStart)
        setCurrentWeek((prev) =>
          prev.getTime() === normalized.getTime() ? prev : normalized
        )
      }
      setEligible(data.eligible ?? true)
      setShifts(data.shifts ?? [])
      if (data.maxScooters) setMaxScooters(data.maxScooters)
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

  const goToPreviousWeek = () => {
    lightClick()
    setCurrentWeek((prev) => addWeekCalendarDays(prev, -7))
  }
  const goToNextWeek = () => {
    lightClick()
    setCurrentWeek((prev) => addWeekCalendarDays(prev, 7))
  }
  const goToCurrentWeek = () => {
    lightClick()
    setCurrentWeek(getWeekStart(new Date()))
  }

  const weekEnd = addWeekCalendarDays(currentWeek, 6)

  const pending = shifts.filter(
    (s) => s.requiresScooterLog && s.isEnded && !s.scooterUsage
  )
  const registered = shifts.filter((s) => s.scooterUsage)

  const formatShiftDate = (shift: ShiftRow) => {
    const d = shiftCalendarDateUtc(currentWeek, shift.dayOfWeek)
    return format(d, 'EEEE d MMMM', { locale: it })
  }

  if (!session) return null

  return (
    <MainLayout>
      <ToastContainer />
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-sky-100">
                <Bike className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                  Utilizzo Scooter
                </h1>
                <p className="text-gray-500 mt-2 text-sm font-medium">
                  Dopo ogni turno, indica quale scooter (1–{maxScooters}) hai usato oppure se hai lavorato in auto.
                </p>
              </div>
            </div>
          </div>
        </div>

        {!eligible && !loading && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-gray-600 font-medium">
              Non devi registrare l&apos;utilizzo scooter: il tuo profilo non prevede consegne in scooter.
            </p>
          </div>
        )}

        {eligible && (
          <>
            <div className="glass rounded-xl shadow-soft p-4 sm:p-6">
              <div className="flex sm:hidden items-center justify-between">
                <button
                  onClick={goToPreviousWeek}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <div className="text-center" onClick={goToCurrentWeek}>
                  <p className="text-xs font-bold text-sky-600 uppercase tracking-widest">
                    {formatMonthYearIt(currentWeek)}
                  </p>
                  <p className="text-xl font-black text-gray-900">
                    {currentWeek.getUTCDate()} - {weekEnd.getUTCDate()}
                  </p>
                </div>
                <button onClick={goToNextWeek} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
              <div className="hidden sm:flex items-center justify-between">
                <button
                  onClick={goToPreviousWeek}
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-sky-600"
                >
                  <ChevronLeft className="h-5 w-5 mr-1" />
                  Settimana precedente
                </button>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900">
                    {formatDate(currentWeek)} - {formatDate(weekEnd)}
                  </h2>
                </div>
                <button
                  onClick={goToNextWeek}
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-sky-600"
                >
                  Settimana successiva
                  <ChevronRight className="h-5 w-5 ml-1" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
              </div>
            ) : (
              <div className="space-y-8">
                <section>
                  <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Da registrare
                    {pending.length > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        {pending.length}
                      </span>
                    )}
                  </h2>
                  {pending.length === 0 ? (
                    <p className="text-gray-500 text-sm font-medium bg-gray-50 rounded-xl p-4">
                      Nessun turno in attesa di registrazione per questa settimana.
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {pending.map((shift) => (
                        <button
                          key={shift.id}
                          onClick={() => openModal(shift)}
                          className="w-full text-left bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 hover:bg-amber-100 transition-colors"
                        >
                          <p className="font-black text-gray-900 capitalize">
                            {formatShiftDate(shift)}
                          </p>
                          <p className="text-sm text-amber-800 font-bold mt-1">
                            {getShiftTypeName(shift.shiftType)} · {shift.startTime} – {shift.endTime}
                          </p>
                          <p className="text-xs text-amber-700 mt-2 font-bold uppercase tracking-wide">
                            Tocca per selezionare lo scooter
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Registrati
                  </h2>
                  {registered.length === 0 ? (
                    <p className="text-gray-500 text-sm font-medium bg-gray-50 rounded-xl p-4">
                      Nessuna registrazione per questa settimana.
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {registered.map((shift) => (
                        <div
                          key={shift.id}
                          className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-4"
                        >
                          <div>
                            <p className="font-black text-gray-900 capitalize">
                              {formatShiftDate(shift)}
                            </p>
                            <p className="text-sm text-green-800 font-medium mt-1">
                              {getShiftTypeName(shift.shiftType)} ·{' '}
                              <span className="font-black">
                                {formatVehicleUsageLabel(shift.scooterUsage!)}
                              </span>
                            </p>
                          </div>
                          <button
                            onClick={() => openModal(shift)}
                            className="text-xs font-black uppercase tracking-widest text-sky-600 hover:text-sky-700 px-3 py-2 border border-sky-200 rounded-xl bg-white"
                          >
                            Modifica
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}

        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false)
            setSelectedShift(null)
          }}
          title="Scooter o auto"
        >
          {selectedShift && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 font-medium capitalize text-center">
                {formatShiftDate(selectedShift)} · {getShiftTypeName(selectedShift.shiftType)}
              </p>
              <button
                type="button"
                disabled={submitting}
                onClick={() => saveUsage({ usedAuto: true })}
                className={`w-full py-4 rounded-2xl font-black border-2 flex items-center justify-center gap-3 transition-all active:scale-95 ${
                  selectedShift.scooterUsage?.usedAuto
                    ? 'bg-gray-800 text-white border-gray-900'
                    : 'bg-white text-gray-900 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <Car className="h-6 w-6" />
                Ho lavorato in auto
              </button>
              <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                oppure seleziona scooter
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].slice(0, maxScooters).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={submitting}
                    onClick={() => saveUsage({ scooterNumber: n, usedAuto: false })}
                    className={`py-8 rounded-2xl text-3xl font-black border-2 transition-all active:scale-95 ${
                      !selectedShift.scooterUsage?.usedAuto &&
                      selectedShift.scooterUsage?.scooterNumber === n
                        ? 'bg-sky-500 text-white border-sky-600'
                        : 'bg-white text-gray-900 border-gray-200 hover:border-sky-400 hover:bg-sky-50'
                    }`}
                  >
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
