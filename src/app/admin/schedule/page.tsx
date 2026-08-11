'use client'

import { useState, useEffect, useRef } from 'react'
import { addWeeks, subWeeks } from 'date-fns'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, Play, Download, Trash2, AlertTriangle, UserPlus, Car, Bike, UserMinus, Clock, Edit, Bell } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState } from '@/components/ui/list-row'
import { WeekNavigator } from '@/components/ui/week-navigator'
import { getNextWeekStart, getWeekDays, formatDate, getDayOfWeek, getWeekStart, addWeekCalendarDays } from '@/lib/date-utils'
import { getDayName, getRoleName, getShiftTypeName, cn, formatUsername } from '@/lib/utils'
import { Role, ShiftType, TransportType } from '@prisma/client'
import { AddShiftModal } from '@/components/admin/add-shift-modal'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Modal } from '@/components/ui/modal'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'

interface ScheduleShift {
  id: string
  userId: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  user: {
    id: string
    username: string
    primaryRole: Role
    primaryTransport: TransportType
    user_transports: { transport: TransportType }[]
  }
}

interface Schedule {
  id: string
  weekStart: string
  shifts: ScheduleShift[]
}

interface Gap {
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  required: number
  assigned: number
}

interface Holiday {
  id: string
  date: string
  closureType: 'FULL_DAY' | 'PRANZO_ONLY' | 'CENA_ONLY'
  description: string | null
}

function holidaysOnCalendarDay(day: Date, holidays: Holiday[]): Holiday[] {
  const key = day.toISOString().split('T')[0]
  return holidays.filter((h) => new Date(h.date).toISOString().split('T')[0] === key)
}

function holidayLabelsForDay(onDay: Holiday[]): { full: boolean; badges: string[] } {
  if (onDay.length === 0) return { full: false, badges: [] }
  if (onDay.some((h) => h.closureType === 'FULL_DAY')) {
    return { full: true, badges: ['Giorno intero'] }
  }
  const badges: string[] = []
  if (onDay.some((h) => h.closureType === 'PRANZO_ONLY')) badges.push('Solo pranzo chiuso')
  if (onDay.some((h) => h.closureType === 'CENA_ONLY')) badges.push('Solo cena chiusa')
  return { full: false, badges }
}

export default function AdminSchedulePage() {
  const { showToast, ToastContainer } = useToast()
  const notify = (message: string) => {
    const clean = message.replace(/[✅❌⚠️ℹ️]/g, '').trim()
    const lower = message.toLowerCase()
    const type =
      message.includes('❌') || lower.includes('errore')
        ? 'error'
        : message.includes('⚠️')
          ? 'warning'
          : message.includes('✅') || lower.includes('successo')
            ? 'success'
            : 'info'
    showToast(clean, type as 'success' | 'error' | 'info' | 'warning')
  }
  const [currentWeek, setCurrentWeek] = useState(getNextWeekStart())
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [gaps, setGaps] = useState<Gap[]>([])
  const [shiftLimits, setShiftLimits] = useState<{ dayOfWeek: number; shiftType: string; role: string; requiredStaff: number }[]>([])
  const [missingAvailability, setMissingAvailability] = useState<string[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showAddShiftModal, setShowAddShiftModal] = useState(false)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [prefilledShiftData, setPrefilledShiftData] = useState<{
    dayOfWeek?: number
    shiftType?: ShiftType
    role?: Role
  } | null>(null)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<ScheduleShift | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const [removing, setRemoving] = useState(false)
  const removeShiftInFlight = useRef(false)

  // Stati per modifica orari
  const [showTimeEditModal, setShowTimeEditModal] = useState(false)
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null)
  const [newStartTime, setNewStartTime] = useState('')
  const [, setNewEndTime] = useState('')
  const [updatingTime, setUpdatingTime] = useState(false)

  // Stati per modifica ruolo
  const [showRoleEditModal, setShowRoleEditModal] = useState(false)
  const [editingRoleShift, setEditingRoleShift] = useState<ScheduleShift | null>(null)
  const [newRole, setNewRole] = useState<Role | ''>('')
  const [updatingRole, setUpdatingRole] = useState(false)

  useEffect(() => {
    fetchSchedule()
    fetchShiftLimits()
    fetchMissingAvailability()
    fetchHolidays()
  }, [currentWeek])

  useEffect(() => {
    if (schedule && shiftLimits.length > 0) {
      calculateGaps()
    }
  }, [schedule, shiftLimits])

  const fetchSchedule = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/schedule/${encodeURIComponent(currentWeek.toISOString())}?_t=${Date.now()}`,
        { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
      )
      if (response.ok) {
        const data = await response.json()
        setSchedule(data)
      } else if (response.status === 404) {
        // Piano non ancora generato - comportamento normale
        console.log(`📅 Nessun piano trovato per la settimana del ${currentWeek.toISOString().split('T')[0]} - clicca "Genera Piano" per crearlo`)
        setSchedule(null)
      }
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHolidays = async () => {
    try {
      const weekDays = getWeekDays(currentWeek)
      const startDate = weekDays[0].toISOString().split('T')[0]
      const endDate = weekDays[6].toISOString().split('T')[0]

      const response = await fetch(`/api/holidays?startDate=${startDate}&endDate=${endDate}`)
      if (response.ok) {
        const data = await response.json()
        setHolidays(data)
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
    }
  }

  const fetchShiftLimits = async () => {
    try {
      const response = await fetch('/api/admin/shift-limits')
      if (response.ok) {
        const data = await response.json()
        setShiftLimits(data)
      }
    } catch (error) {
      console.error('Error fetching shift limits:', error)
    }
  }

  const fetchMissingAvailability = async () => {
    try {
      const qs = encodeURIComponent(currentWeek.toISOString())
      const response = await fetch(
        `/api/admin/missing-availability?weekStart=${qs}&_t=${Date.now()}`,
        { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
      )
      if (response.ok) {
        const data = await response.json()
        setMissingAvailability(data.missingUsers.sort())
      }
    } catch (error) {
      console.error('Error fetching missing availability:', error)
    }
  }

  const calculateGaps = () => {
    if (!schedule || shiftLimits.length === 0) {
      setGaps([])
      return
    }

    const calculatedGaps: Gap[] = []
    const roles: Role[] = ['CUCINA', 'FATTORINO', 'SALA']
    const shiftTypes: ShiftType[] = ['PRANZO', 'CENA']

    // Group shifts by day/shift/role
    const shiftGroups: Record<string, ScheduleShift[]> = {}
    schedule.shifts.forEach(shift => {
      const key = `${shift.dayOfWeek}-${shift.shiftType}-${shift.role}`
      if (!shiftGroups[key]) {
        shiftGroups[key] = []
      }
      shiftGroups[key].push(shift)
    })

    // Calculate gaps for each day/shift/role combination
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      for (const shiftType of shiftTypes) {
        for (const role of roles) {
          const limit = shiftLimits.find(l =>
            l.dayOfWeek === dayOfWeek &&
            l.shiftType === shiftType &&
            l.role === role
          )

          if (limit && limit.requiredStaff > 0) {
            const key = `${dayOfWeek}-${shiftType}-${role}`
            const assigned = shiftGroups[key] ? shiftGroups[key].length : 0

            if (assigned < limit.requiredStaff) {
              calculatedGaps.push({
                dayOfWeek,
                shiftType,
                role,
                required: limit.requiredStaff,
                assigned
              })
            }
          }
        }
      }
    }

    setGaps(calculatedGaps)
  }

  const generateSchedule = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/admin/schedule/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          weekStart: currentWeek.toISOString()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setGaps(data.gaps || [])
        await fetchSchedule()
        notify(`Piano generato con successo! ${data.shiftsGenerated} turni assegnati.`)
      } else {
        notify('Errore durante la generazione del piano')
      }
    } catch (error) {
      console.error('Error generating schedule:', error)
      notify('Errore durante la generazione del piano')
    } finally {
      setGenerating(false)
    }
  }

  const deleteSchedule = async () => {
    try {
      const response = await fetch(`/api/admin/schedule/${currentWeek.toISOString()}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSchedule(null)
        setGaps([])
        notify('Piano eliminato con successo')
      } else {
        notify('Errore durante l\'eliminazione del piano')
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
      notify('Errore durante l\'eliminazione del piano')
    }
  }

  const notifyUsers = async () => {
    if (!schedule) {
      notify('Nessun piano disponibile per questa settimana')
      return
    }

    setNotifying(true)
    try {
      const response = await fetch('/api/admin/schedule/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          weekStart: currentWeek.toISOString()
        })
      })

      const data = await response.json()

      if (response.ok) {
        if (data.success) {
          notify(`✅ ${data.message || `Notifiche inviate con successo a ${data.successful || 0} utenti!`}`)
        } else {
          notify(`⚠️ ${data.error || 'Errore durante l\'invio delle notifiche'}`)
        }
      } else {
        const errorMessage = data.error || 'Errore durante l\'invio delle notifiche'
        let details = data.message ? `\n\n${data.message}` : ''
        if (data.debug) {
          details += `\n\nDebug:\nCercato: ${data.debug.searched}\nEsistenti: ${data.debug.existing.join(', ')}`
        }
        notify(`❌ ${errorMessage}${details}`)
      }
    } catch (error: any) {
      console.error('Error sending notifications:', error)
      notify(`❌ Errore durante l'invio delle notifiche: ${error.message || 'Errore di connessione'}`)
    } finally {
      setNotifying(false)
    }
  }

  const exportToPDF = async () => {
    try {
      const weekSeg = encodeURIComponent(currentWeek.toISOString())
      const response = await fetch(`/api/admin/schedule/${weekSeg}/export-pdf`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (response.ok) {
        // Ottieni il PDF come blob
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        
        // Estrai il nome del file dall'header Content-Disposition o usa un default
        const contentDisposition = response.headers.get('Content-Disposition')
        let fileName = `Piano-Lavoro-${currentWeek.toISOString().split('T')[0]}.pdf`
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="(.+)"/)
          if (fileNameMatch) {
            fileName = fileNameMatch[1]
          }
        }
        
        // Crea un link temporaneo per il download automatico
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        
        // Pulisci dopo il download
        setTimeout(() => {
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }, 100)
      } else {
        const error = await response.json().catch(() => ({ error: 'Errore sconosciuto' }))
        notify(`❌ Errore durante l'esportazione PDF: ${error.error || error.details || 'Errore sconosciuto'}`)
      }
    } catch (error: any) {
      console.error('Error exporting PDF:', error)
      notify(`❌ Errore durante l'esportazione PDF: ${error.message || 'Errore di connessione'}`)
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    // ⭐ USA getWeekStart per garantire normalizzazione UTC corretta
    const newWeek = direction === 'next'
      ? getWeekStart(addWeeks(currentWeek, 1))
      : getWeekStart(subWeeks(currentWeek, 1))
    setCurrentWeek(newWeek)
  }

  const handleRemoveShift = (shift: ScheduleShift) => {
    setSelectedShift(shift)
    setRemoveReason('')
    setShowRemoveModal(true)
  }

  const confirmRemoveShift = async () => {
    if (!selectedShift) return
    if (removeShiftInFlight.current) return
    removeShiftInFlight.current = true

    setRemoving(true)
    try {
      const response = await fetch('/api/admin/schedule/remove-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shiftId: selectedShift.id,
          reason: removeReason,
          createSubstitution: false
        })
      })

      if (response.ok) {
        const result = await response.json()
        setShowRemoveModal(false)
        await fetchSchedule()

        if (result.alreadyRemoved) {
          notify('Il turno era già stato rimosso. Il piano è aggiornato.')
        } else {
          notify(`Turno di ${result.username} rimosso definitivamente.`)
        }
      } else {
        const error = await response.json()
        notify(error.error || 'Errore nella rimozione')
      }
    } catch (error) {
      console.error('Error removing shift:', error)
      notify('Errore nella rimozione del turno')
    } finally {
      removeShiftInFlight.current = false
      setRemoving(false)
    }
  }

  const handleEditShiftTime = (shift: ScheduleShift) => {
    setEditingShift(shift)
    setNewStartTime(shift.startTime)
    setNewEndTime(shift.endTime)
    setShowTimeEditModal(true)
  }

  const confirmTimeUpdate = async () => {
    if (!editingShift) return

    setUpdatingTime(true)
    try {
      const endTime = editingShift.shiftType === 'PRANZO' ? '14:00' : '22:00'
      const response = await fetch(`/api/admin/shifts/${editingShift.id}/times`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime: newStartTime,
          endTime: endTime
        })
      })

      if (response.ok) {
        setShowTimeEditModal(false)
        setEditingShift(null)
        fetchSchedule() // Ricarica il piano
      } else {
        const error = await response.json()
        notify(error.error || 'Errore nell\'aggiornamento degli orari')
      }
    } catch (error) {
      console.error('Error updating shift times:', error)
      notify('Errore nell\'aggiornamento degli orari')
    } finally {
      setUpdatingTime(false)
    }
  }

  const handleEditRole = (shift: ScheduleShift) => {
    setEditingRoleShift(shift)
    setNewRole(shift.role)
    setShowRoleEditModal(true)
  }

  const confirmRoleUpdate = async () => {
    if (!editingRoleShift || !newRole) return

    setUpdatingRole(true)
    try {
      const response = await fetch(`/api/admin/shifts/${editingRoleShift.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: newRole
        })
      })

      if (response.ok) {
        setShowRoleEditModal(false)
        setEditingRoleShift(null)
        fetchSchedule() // Ricarica il piano
      } else {
        const error = await response.json()
        notify(error.error || 'Errore nell\'aggiornamento del ruolo')
      }
    } catch (error) {
      console.error('Error updating shift role:', error)
      notify('Errore nell\'aggiornamento del ruolo')
    } finally {
      setUpdatingRole(false)
    }
  }

  const handleQuickAdd = (dayOfWeek: number, shiftType: ShiftType, role: Role) => {
    // Imposta i parametri precompilati
    setPrefilledShiftData({
      dayOfWeek,
      shiftType,
      role
    })
    // Apri il modal di aggiunta turno
    setShowAddShiftModal(true)
  }

  const groupShiftsByDayAndShift = () => {
    if (!schedule) return {}

    const groups: Record<string, ScheduleShift[]> = {}

    schedule.shifts.forEach(shift => {
      const key = `${shift.dayOfWeek}-${shift.shiftType}`
      if (!groups[key]) groups[key] = []
      groups[key].push(shift)
    })

    return groups
  }

  const weekDays = getWeekDays(currentWeek)
  const shiftGroups = groupShiftsByDayAndShift()

  const staffCount = schedule ? [...new Set(schedule.shifts.map(s => s.userId))].length : 0
  const shiftCount = schedule?.shifts.length ?? 0
  const coveragePct = (() => {
    if (!schedule || shiftLimits.length === 0) return 0
    let required = 0
    let assigned = 0
    const roles: Role[] = ['CUCINA', 'FATTORINO', 'SALA']
    const shiftTypes: ShiftType[] = ['PRANZO', 'CENA']
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      for (const shiftType of shiftTypes) {
        for (const role of roles) {
          const limit = shiftLimits.find(
            (l) => l.dayOfWeek === dayOfWeek && l.shiftType === shiftType && l.role === role
          )
          if (!limit || limit.requiredStaff <= 0) continue
          required += limit.requiredStaff
          assigned += schedule.shifts.filter(
            (s) => s.dayOfWeek === dayOfWeek && s.shiftType === shiftType && s.role === role
          ).length
        }
      }
    }
    if (required === 0) return schedule.shifts.length > 0 ? 100 : 0
    return Math.min(100, Math.round((assigned / required) * 100))
  })()

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <ToastContainer />
      <div className="pd-page pb-16">
        <PageHeader
          dense
          title="Piano di lavoro"
          subtitle="Gestione settimanale operativa"
          action={
            <>
              {schedule && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold pd-press"
                    style={{
                      color: 'var(--pd-danger)',
                      background: 'var(--pd-danger-soft)',
                      borderRadius: 'var(--pd-radius)',
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Elimina
                  </button>
                  <button
                    type="button"
                    onClick={exportToPDF}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold pd-press"
                    style={{
                      color: 'var(--pd-text)',
                      background: 'var(--pd-surface-muted)',
                      borderRadius: 'var(--pd-radius)',
                    }}
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={notifyUsers}
                    disabled={notifying}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold pd-press disabled:opacity-50"
                    style={{
                      color: 'var(--pd-text)',
                      background: 'var(--pd-surface-muted)',
                      borderRadius: 'var(--pd-radius)',
                    }}
                  >
                    <Bell className={cn('h-4 w-4', notifying && 'animate-pulse')} />
                    Notifica
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setShowGenerateConfirm(true)}
                disabled={generating}
                className="pd-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                <Play className={cn('h-4 w-4', generating && 'animate-spin')} />
                Genera piano
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrefilledShiftData(null)
                  setShowAddShiftModal(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold pd-press"
                style={{
                  color: 'var(--pd-success)',
                  background: 'var(--pd-success-soft)',
                  borderRadius: 'var(--pd-radius)',
                }}
              >
                <UserPlus className="h-4 w-4" />
                Nuovo turno
              </button>
            </>
          }
        />

        <WeekNavigator
          label={`${formatDate(weekDays[0])} — ${formatDate(weekDays[6])}`}
          hint={schedule ? 'Piano settimanale attivo' : 'Nessun piano per questa settimana'}
          onPrev={() => navigateWeek('prev')}
          onNext={() => navigateWeek('next')}
          disabled={loading || generating}
        />

        <StatStrip
          items={[
            { label: 'Copertura', value: `${coveragePct}%` },
            { label: 'Collaboratori', value: staffCount },
            { label: 'Turni', value: shiftCount },
            { label: 'Lacune', value: gaps.length },
          ]}
        />

        {missingAvailability.length > 0 && (
          <div
            className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
            style={{
              background: 'var(--pd-surface)',
              border: '1px solid var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
              boxShadow: 'var(--pd-shadow)',
            }}
          >
            <div className="flex items-center gap-2 shrink-0">
              <AlertTriangle className="h-4 w-4" style={{ color: 'var(--pd-warning)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                {missingAvailability.length}{' '}
                {missingAvailability.length === 1
                  ? 'disponibilità mancante'
                  : 'disponibilità mancanti'}
              </p>
            </div>
            <p className="text-xs sm:text-sm min-w-0 truncate" style={{ color: 'var(--pd-muted)' }}>
              {missingAvailability.join(' · ')}
            </p>
          </div>
        )}

        <SectionBlock
          title="Matrice settimanale"
          subtitle="Pranzo e cena per ruolo · tocca un collaboratore per modificare"
          card
        >
          {loading ? (
            <div className="p-8 space-y-6">
              <Skeleton className="h-10 w-48" />
              <TableSkeleton rows={7} cols={3} />
            </div>
          ) : schedule ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[780px]">
                <thead>
                  <tr>
                    <th
                      className="sticky left-0 z-[1] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide w-[128px]"
                      style={{
                        color: 'var(--pd-muted)',
                        background: 'var(--pd-surface-muted)',
                        borderBottom: '1px solid var(--pd-border)',
                      }}
                    >
                      Giorno
                    </th>
                    {(['PRANZO', 'CENA'] as const).map((slot) => (
                      <th
                        key={slot}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide"
                        style={{
                          color: 'var(--pd-muted)',
                          background: 'var(--pd-surface-muted)',
                          borderBottom: '1px solid var(--pd-border)',
                          borderLeft: '1px solid var(--pd-border)',
                        }}
                      >
                        {slot === 'PRANZO' ? 'Pranzo' : 'Cena'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((day, index) => {
                    const dayOfWeek = getDayOfWeek(day)
                    const pranzoCrew = shiftGroups[`${dayOfWeek}-PRANZO`] || []
                    const cenaCrew = shiftGroups[`${dayOfWeek}-CENA`] || []
                    const dayHolidays = holidaysOnCalendarDay(day, holidays)
                    const { full: isFullClosureDay, badges: holidayBadges } = holidayLabelsForDay(dayHolidays)
                    const holidayDescriptions = [
                      ...new Set(
                        dayHolidays.map((h) => h.description?.trim()).filter(Boolean) as string[]
                      ),
                    ]
                    const dayAssigned =
                      pranzoCrew.length +
                      cenaCrew.length

                    return (
                      <tr
                        key={`${dayOfWeek}-${index}`}
                        style={{
                          background: isFullClosureDay
                            ? 'color-mix(in srgb, var(--pd-danger-soft) 55%, var(--pd-surface))'
                            : index % 2 === 0
                              ? 'var(--pd-surface)'
                              : 'color-mix(in srgb, var(--pd-surface-muted) 45%, var(--pd-surface))',
                          borderBottom: '1px solid var(--pd-border)',
                        }}
                      >
                        <td
                          className="sticky left-0 z-[1] px-4 py-4 align-top"
                          style={{
                            background: 'inherit',
                            borderRight: '1px solid var(--pd-border)',
                          }}
                        >
                          <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                            {getDayName(dayOfWeek)}
                          </p>
                          <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--pd-muted)' }}>
                            {formatDate(day)}
                          </p>
                          {!isFullClosureDay && dayAssigned > 0 && (
                            <p className="text-[11px] mt-2 tabular-nums" style={{ color: 'var(--pd-muted)' }}>
                              {dayAssigned} in servizio
                            </p>
                          )}
                          {holidayBadges.length > 0 && (
                            <div className="flex flex-col gap-1 mt-2">
                              {holidayBadges.map((label) => (
                                <span
                                  key={label}
                                  className="inline-flex self-start px-2 py-0.5 text-[11px] font-medium"
                                  style={{
                                    background: 'var(--pd-surface)',
                                    color: 'var(--pd-danger)',
                                    borderRadius: 'var(--pd-radius-sm)',
                                    border: '1px solid var(--pd-border)',
                                  }}
                                >
                                  {label}
                                </span>
                              ))}
                              {holidayDescriptions.length > 0 && (
                                <span className="text-[11px]" style={{ color: 'var(--pd-muted)' }}>
                                  {holidayDescriptions.join(' · ')}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td
                          className="px-3 py-3 align-top"
                          style={{ borderLeft: '1px solid var(--pd-border)' }}
                        >
                          <ShiftCrew
                            shifts={pranzoCrew}
                            day={day}
                            dayOfWeek={dayOfWeek}
                            shiftType="PRANZO"
                            gaps={gaps}
                            shiftLimits={shiftLimits}
                            holidays={holidays}
                            onRemoveShift={handleRemoveShift}
                            onEditTime={handleEditShiftTime}
                            onEditRole={handleEditRole}
                            onQuickAdd={handleQuickAdd}
                          />
                        </td>
                        <td
                          className="px-3 py-3 align-top"
                          style={{ borderLeft: '1px solid var(--pd-border)' }}
                        >
                          <ShiftCrew
                            shifts={cenaCrew}
                            day={day}
                            dayOfWeek={dayOfWeek}
                            shiftType="CENA"
                            gaps={gaps}
                            shiftLimits={shiftLimits}
                            holidays={holidays}
                            onRemoveShift={handleRemoveShift}
                            onEditTime={handleEditShiftTime}
                            onEditRole={handleEditRole}
                            onQuickAdd={handleQuickAdd}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nessun piano generato"
              description="Configura le disponibilità e genera il piano per questa settimana."
              icon={<Calendar className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
              action={
                <button
                  type="button"
                  onClick={() => setShowGenerateConfirm(true)}
                  className="pd-btn-primary px-4 py-2 text-sm font-semibold"
                >
                  Genera ora
                </button>
              }
            />
          )}
        </SectionBlock>
      </div>

      {/* Add Shift Modal */}
      {showAddShiftModal && (
        <AddShiftModal
          weekStart={currentWeek}
          prefilledData={prefilledShiftData}
          onClose={() => {
            setShowAddShiftModal(false)
            setPrefilledShiftData(null)
          }}
          onShiftAdded={() => {
            setShowAddShiftModal(false)
            setPrefilledShiftData(null)
            fetchSchedule() // Refresh the schedule
          }}
        />
      )}

      {/* Remove Shift Modal */}
      <Modal
        isOpen={showRemoveModal && !!selectedShift}
        onClose={() => setShowRemoveModal(false)}
        title="Rimuovi dal Turno"
      >
        {selectedShift && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-[var(--pd-danger-soft)]/50 p-5 rounded-xl border border-[var(--pd-border)]">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg"
                  style={{ background: 'var(--pd-danger)', color: 'var(--pd-accent-fg)' }}
                >
                  {selectedShift.user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-sm" style={{ color: 'var(--pd-danger)' }}>
                    {formatUsername(selectedShift.user.username)}
                  </h4>
                  <p className="text-xs text-[var(--pd-danger)] font-medium">Sarà rimosso dal turno</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold" style={{ color: 'var(--pd-danger)' }}>Giorno</p>
                  <p className="font-semibold" style={{ color: 'var(--pd-danger)' }}>{getDayName(selectedShift.dayOfWeek)}</p>
                </div>
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold" style={{ color: 'var(--pd-danger)' }}>Turno</p>
                  <p className="font-semibold" style={{ color: 'var(--pd-danger)' }}>{getShiftTypeName(selectedShift.shiftType)}</p>
                </div>
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold" style={{ color: 'var(--pd-danger)' }}>Ruolo</p>
                  <p className="font-semibold" style={{ color: 'var(--pd-danger)' }}>{getRoleName(selectedShift.role)}</p>
                </div>
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold" style={{ color: 'var(--pd-danger)' }}>Orario</p>
                  <p className="font-semibold" style={{ color: 'var(--pd-danger)' }}>{selectedShift.startTime} - {selectedShift.endTime}</p>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold text-[var(--pd-muted)]  mb-3">
                Motivo (opzionale)
              </label>
              <textarea
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                rows={3}
                className="w-full border-2 border-[var(--pd-border)] rounded-xl px-5 py-4 text-[var(--pd-text)] placeholder-[var(--pd-muted)]/50 bg-[var(--pd-surface-muted)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--pd-danger)] focus:border-[var(--pd-danger)] focus:bg-[var(--pd-surface)] transition-all resize-none"
                placeholder="Motivo della rimozione..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--pd-border)]">
              <button
                type="button"
                onClick={() => setShowRemoveModal(false)}
                className="px-6 py-3 text-xs font-semibold text-[var(--pd-muted)]  hover:bg-[var(--pd-surface-muted)] rounded-xl transition-all"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmRemoveShift}
                disabled={removing}
                className="px-8 py-3 text-xs font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                style={{ background: 'var(--pd-danger)', color: 'var(--pd-accent-fg)' }}
              >
                {removing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Conferma Rimozione
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Modifica Orari */}
      <Modal
        isOpen={showTimeEditModal && !!editingShift}
        onClose={() => setShowTimeEditModal(false)}
        title="Modifica Orario"
      >
        {editingShift && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-[var(--pd-accent-soft)]/50 p-5 rounded-xl border border-[var(--pd-border)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[var(--pd-accent)] rounded-xl flex items-center justify-center font-semibold text-lg" style={{ color: 'var(--pd-accent-fg)' }}>
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm" style={{ color: 'var(--pd-text)' }}>
                    {formatUsername(editingShift.user.username)}
                  </h4>
                  <p className="text-xs text-[var(--pd-accent)] font-medium">Modifica orario di inizio</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-accent)] ">Giorno</p>
                  <p className="font-semibold" style={{ color: 'var(--pd-text)' }}>{getDayName(editingShift.dayOfWeek)}</p>
                </div>
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-accent)] ">Turno</p>
                  <p className="font-semibold" style={{ color: 'var(--pd-text)' }}>{getShiftTypeName(editingShift.shiftType)}</p>
                </div>
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-accent)] ">Ruolo</p>
                  <p className="font-semibold" style={{ color: 'var(--pd-text)' }}>{getRoleName(editingShift.role)}</p>
                </div>
              </div>
            </div>

            {/* Start Time Selection */}
            <div>
              <label className="block text-xs font-semibold text-[var(--pd-muted)]  mb-3">
                Orario Inizio
              </label>
              <select
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full border-2 border-[var(--pd-border)] rounded-xl px-5 py-4 text-[var(--pd-text)] bg-[var(--pd-surface-muted)] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all appearance-none cursor-pointer"
              >
                <option value="">Seleziona orario</option>
                {(editingShift.shiftType === 'PRANZO' ? [
                  { value: '11:00', label: '11:00' },
                  { value: '11:30', label: '11:30' },
                  { value: '12:00', label: '12:00' }
                ] : [
                  { value: '17:00', label: '17:00' },
                  { value: '17:30', label: '17:30' },
                  { value: '18:00', label: '18:00' },
                  { value: '18:30', label: '18:30' },
                  { value: '19:00', label: '19:00' }
                ]).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <p className="text-xs text-[var(--pd-muted)] font-medium bg-[var(--pd-surface-muted)] px-4 py-3 rounded-xl">
              Gli orari di fine sono fissi per tutti i turni
            </p>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--pd-border)]">
              <button
                type="button"
                onClick={() => setShowTimeEditModal(false)}
                className="px-6 py-3 text-xs font-semibold text-[var(--pd-muted)]  hover:bg-[var(--pd-surface-muted)] rounded-xl transition-all"
              >
                Annulla
              </button>
              <button
                onClick={confirmTimeUpdate}
                disabled={!newStartTime || updatingTime}
                className="px-8 py-3 bg-[var(--pd-accent)] text-white text-xs font-semibold  rounded-xl  hover:bg-[var(--pd-accent-hover)] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {updatingTime && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Aggiorna Orario
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Modifica Ruolo */}
      <Modal
        isOpen={showRoleEditModal && !!editingRoleShift}
        onClose={() => setShowRoleEditModal(false)}
        title="Modifica Ruolo"
      >
        {editingRoleShift && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-[var(--pd-accent-soft)]/50 p-5 rounded-xl border border-[var(--pd-border)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[var(--pd-accent)] rounded-xl flex items-center justify-center font-semibold text-lg" style={{ color: 'var(--pd-accent-fg)' }}>
                  <Edit className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-[var(--pd-text)] text-sm ">
                    {formatUsername(editingRoleShift.user.username)}
                  </h4>
                  <p className="text-xs text-[var(--pd-accent)] font-medium">Cambia ruolo per questo turno</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] ">Giorno</p>
                  <p className="font-semibold text-[var(--pd-text)]">{getDayName(editingRoleShift.dayOfWeek)}</p>
                </div>
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] ">Turno</p>
                  <p className="font-semibold text-[var(--pd-text)]">{getShiftTypeName(editingRoleShift.shiftType)}</p>
                </div>
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] ">Ruolo Attuale</p>
                  <p className="font-semibold text-[var(--pd-text)]">{getRoleName(editingRoleShift.role)}</p>
                </div>
                <div className="bg-[var(--pd-surface)]/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] ">Ruolo Principale</p>
                  <p className="font-semibold text-[var(--pd-text)]">{getRoleName(editingRoleShift.user.primaryRole)}</p>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold text-[var(--pd-muted)]  mb-3">
                Nuovo Ruolo
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full border-2 border-[var(--pd-border)] rounded-xl px-5 py-4 text-[var(--pd-text)] bg-[var(--pd-surface-muted)] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all appearance-none cursor-pointer"
              >
                <option value="">Seleziona ruolo</option>
                <option value="FATTORINO">{getRoleName('FATTORINO')}</option>
                <option value="CUCINA">{getRoleName('CUCINA')}</option>
                <option value="SALA">{getRoleName('SALA')}</option>
                <option value="PIZZAIOLO">{getRoleName('PIZZAIOLO')}</option>
              </select>
            </div>

            <p className="text-xs text-[var(--pd-muted)] font-medium bg-[var(--pd-surface-muted)] px-4 py-3 rounded-xl">
              Verifica che l&apos;utente possa svolgere questo ruolo
            </p>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--pd-border)]">
              <button
                type="button"
                onClick={() => setShowRoleEditModal(false)}
                className="px-6 py-3 text-xs font-semibold text-[var(--pd-muted)]  hover:bg-[var(--pd-surface-muted)] rounded-xl transition-all"
              >
                Annulla
              </button>
              <button
                onClick={confirmRoleUpdate}
                disabled={!newRole || updatingRole}
                className="px-8 py-3 bg-[var(--pd-accent)] text-white text-xs font-semibold  rounded-xl  hover:bg-[var(--pd-accent-hover)] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {updatingRole && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Aggiorna Ruolo
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Generate Schedule Confirmation Modal */}
      <ConfirmationModal
        isOpen={showGenerateConfirm}
        onClose={() => setShowGenerateConfirm(false)}
        onConfirm={async () => {
          await generateSchedule()
          setShowGenerateConfirm(false)
        }}
        title="Genera Piano Settimanale"
        description="Stai per generare un nuovo piano settimanale. Se esiste già un piano per questa settimana, verrà sostituito. Questa azione è irreversibile."
        confirmPhrase="GENERA PIANO"
        confirmButtonText="Genera Piano"
        isDangerous={true}
        metadata={
          <div className="text-sm space-y-1">
            <p><strong>Settimana:</strong> {formatDate(currentWeek)} - {formatDate(addWeekCalendarDays(currentWeek, 6))}</p>
            <p><strong>Modalità:</strong> Algoritmo massima copertura</p>
            {missingAvailability.length > 0 && (
              <p style={{ color: 'var(--pd-warning)' }}><strong>Attenzione:</strong> {missingAvailability.length} utenti senza disponibilità</p>
            )}
          </div>
        }
      />

      {/* Delete Schedule Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          await deleteSchedule()
          setShowDeleteConfirm(false)
        }}
        title="Elimina Piano Settimanale"
        description="Stai per eliminare completamente il piano di questa settimana. Tutti i turni assegnati verranno rimossi. Questa azione NON può essere annullata."
        confirmPhrase="ELIMINA PIANO"
        confirmButtonText="Elimina Piano"
        isDangerous={true}
        metadata={
          <div className="text-sm space-y-1">
            <p><strong>Settimana:</strong> {formatDate(currentWeek)} - {formatDate(addWeekCalendarDays(currentWeek, 6))}</p>
            {schedule && <p><strong>Turni da eliminare:</strong> {schedule.shifts.length}</p>}
          </div>
        }
      />
    </MainLayout>
  )
}

// Helper function for transport icons
function getTransportIcon(user: ScheduleShift['user'], role: Role) {
  // Only show transport icons for delivery roles
  if (role !== 'FATTORINO') {
    return null
  }

  const primaryTransport = user.primaryTransport

  switch (primaryTransport) {
    case 'AUTO':
      return <Car className="h-3 w-3 text-[var(--pd-accent)]" />
    case 'SCOOTER':
      return <Bike className="h-3 w-3 text-[var(--pd-success)]" />
    default:
      return null
  }
}

function ShiftCrew({
  shifts,
  day,
  dayOfWeek,
  shiftType,
  shiftLimits,
  holidays,
  onRemoveShift,
  onEditTime,
  onEditRole,
  onQuickAdd,
}: {
  shifts: ScheduleShift[]
  day: Date
  dayOfWeek: number
  shiftType: ShiftType
  gaps: Gap[]
  shiftLimits: { dayOfWeek: number; shiftType: string; role: string; requiredStaff: number }[]
  holidays: Holiday[]
  onRemoveShift?: (shift: ScheduleShift) => void
  onEditTime?: (shift: ScheduleShift) => void
  onEditRole?: (shift: ScheduleShift) => void
  onQuickAdd?: (dayOfWeek: number, shiftType: ShiftType, role: Role) => void
}) {
  const isHoliday = holidays.some((h) => {
    const holidayDate = new Date(h.date).toISOString().split('T')[0]
    const currentDate = day.toISOString().split('T')[0]
    return (
      holidayDate === currentDate &&
      (h.closureType === 'FULL_DAY' ||
        (h.closureType === 'PRANZO_ONLY' && shiftType === 'PRANZO') ||
        (h.closureType === 'CENA_ONLY' && shiftType === 'CENA'))
    )
  })

  if (isHoliday) {
    return (
      <div
        className="flex items-center justify-center py-6 text-xs font-semibold"
        style={{
          color: 'var(--pd-danger)',
          background: 'var(--pd-danger-soft)',
          borderRadius: 'var(--pd-radius)',
          border: '1px dashed color-mix(in srgb, var(--pd-danger) 35%, transparent)',
        }}
      >
        Chiuso
      </div>
    )
  }

  const byRole = shifts.reduce(
    (acc, shift) => {
      if (!acc[shift.role]) acc[shift.role] = []
      acc[shift.role].push(shift)
      return acc
    },
    {} as Record<Role, ScheduleShift[]>
  )

  const roleOrder: Role[] = ['PIZZAIOLO', 'CUCINA', 'FATTORINO', 'SALA']
  const allRoles = new Set<Role>()

  shiftLimits.forEach((limit) => {
    if (limit.dayOfWeek === dayOfWeek && limit.shiftType === shiftType && limit.requiredStaff > 0) {
      allRoles.add(limit.role as Role)
    }
  })
  shifts.forEach((shift) => allRoles.add(shift.role))

  const orderedRoles = roleOrder.filter((r) => allRoles.has(r))

  if (orderedRoles.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--pd-muted)' }}>
        Nessun requisito
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {orderedRoles.map((role) => {
        const roleShifts = byRole[role] || []
        const limit = shiftLimits.find(
          (l) => l.dayOfWeek === dayOfWeek && l.shiftType === shiftType && l.role === role
        )
        const required = limit?.requiredStaff || 0
        const assigned = roleShifts.length
        const missing = Math.max(0, required - assigned)
        const fillPct = required > 0 ? Math.min(100, Math.round((assigned / required) * 100)) : 100
        const complete = missing === 0 && required > 0

        return (
          <div
            key={role}
            className="rounded-[var(--pd-radius)] p-2.5"
            style={{
              background: 'var(--pd-surface)',
              border: `1px solid ${
                missing > 0
                  ? 'color-mix(in srgb, var(--pd-danger) 28%, var(--pd-border))'
                  : 'var(--pd-border)'
              }`,
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2 group/role">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--pd-text)' }}>
                  {getRoleName(role)}
                </p>
                <span
                  className="text-[11px] font-medium tabular-nums shrink-0"
                  style={{ color: complete ? 'var(--pd-success)' : 'var(--pd-muted)' }}
                >
                  {assigned}/{required || '—'}
                </span>
                {onQuickAdd && (
                  <button
                    type="button"
                    onClick={() => onQuickAdd(dayOfWeek, shiftType, role)}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full transition-opacity opacity-100 md:opacity-0 md:group-hover/role:opacity-100"
                    style={{ background: 'var(--pd-accent)', color: 'var(--pd-accent-fg)' }}
                    title={`Aggiungi ${getRoleName(role)}`}
                  >
                    <UserPlus className="h-3 w-3" />
                  </button>
                )}
              </div>
              {required > 0 && (
                <div
                  className="h-1 w-14 rounded-full overflow-hidden shrink-0"
                  style={{ background: 'var(--pd-surface-muted)' }}
                  title={`${fillPct}% copertura`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${fillPct}%`,
                      background: complete ? 'var(--pd-success)' : 'var(--pd-warning)',
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {roleShifts.map((shift) => {
                const transportIcon = getTransportIcon(shift.user, shift.role)
                return (
                  <div
                    key={shift.id}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 text-xs font-medium group relative"
                    style={{
                      background: 'var(--pd-surface-muted)',
                      color: 'var(--pd-text)',
                      borderRadius: 'var(--pd-radius-pill)',
                      border: '1px solid var(--pd-border)',
                    }}
                  >
                    <span className="truncate max-w-[7.5rem]">{formatUsername(shift.user.username)}</span>
                    {transportIcon}
                    <span className="tabular-nums" style={{ color: 'var(--pd-muted)' }}>
                      {shift.startTime}
                    </span>
                    <span className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {onEditTime && (
                        <button
                          type="button"
                          onClick={() => onEditTime(shift)}
                          className="p-1"
                          style={{ color: 'var(--pd-muted)' }}
                          title="Modifica orari"
                        >
                          <Clock className="h-3 w-3" />
                        </button>
                      )}
                      {onEditRole && (
                        <button
                          type="button"
                          onClick={() => onEditRole(shift)}
                          className="p-1"
                          style={{ color: 'var(--pd-muted)' }}
                          title="Modifica ruolo"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      )}
                      {onRemoveShift && (
                        <button
                          type="button"
                          onClick={() => onRemoveShift(shift)}
                          className="p-1"
                          style={{ color: 'var(--pd-danger)' }}
                          title="Rimuovi dal turno"
                        >
                          <UserMinus className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}

              {Array.from({ length: missing }).map((_, i) => (
                <button
                  key={`gap-${role}-${i}`}
                  type="button"
                  onClick={() => onQuickAdd?.(dayOfWeek, shiftType, role)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium pd-press"
                  style={{
                    color: 'var(--pd-danger)',
                    background: 'transparent',
                    borderRadius: 'var(--pd-radius-pill)',
                    border: '1px dashed color-mix(in srgb, var(--pd-danger) 45%, var(--pd-border))',
                  }}
                  title={`Aggiungi ${getRoleName(role)}`}
                >
                  <UserPlus className="h-3 w-3" />
                  Slot libero
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
