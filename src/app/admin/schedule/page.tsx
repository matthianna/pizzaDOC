'use client'

import { useState, useEffect, useRef } from 'react'
import { addWeeks, subWeeks } from 'date-fns'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, ChevronLeft, ChevronRight, Play, Download, Trash2, AlertTriangle, UserPlus, Car, Bike, UserMinus, Clock, X, BarChart3, Edit, ChevronDown, ChevronUp, Bell, Target, TrendingUp, Users, Check, Sparkles } from 'lucide-react'
import { getNextWeekStart, getWeekDays, formatDate, getDayOfWeek, getWeekStart, addWeekCalendarDays } from '@/lib/date-utils'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { Role, ShiftType, TransportType } from '@prisma/client'
import { AddShiftModal } from '@/components/admin/add-shift-modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
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

  return (
    <MainLayout adminOnly>
      <ToastContainer />
      <div className="space-y-8 max-w-[1600px] mx-auto pb-20">
        {/* Advanced Header */}
        <div className="relative overflow-hidden bg-[var(--pd-surface)] rounded-[2.5rem] p-8 shadow-[var(--pd-shadow)] border border-[var(--pd-border)]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--pd-accent-soft)] rounded-full blur-3xl -mr-32 -mt-32 opacity-60"></div>
          
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-[var(--pd-accent)] rounded-3xl shadow-xl shadow-[var(--pd-shadow)] text-white transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                <Calendar className="h-8 w-8" />
              </div>
              <div>
                <h1 className="pd-display text-3xl font-semibold text-[var(--pd-text)] tracking-tight leading-none">Piano di Lavoro</h1>
                <p className="text-[var(--pd-muted)] font-bold uppercase tracking-widest text-[10px] mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--pd-success)] animate-pulse" />
                  Gestione Settimanale Operativa
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {schedule && (
                <>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="group px-5 py-3.5 bg-[var(--pd-danger-soft)] text-[var(--pd-danger)] text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all duration-300 flex items-center gap-2 border border-[var(--pd-border)] shadow-sm"
                  >
                    <Trash2 className="h-4 w-4 transition-transform group-hover:scale-110" />
                    Elimina
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="group px-5 py-3.5 bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[var(--pd-accent-hover)] hover:text-white transition-all duration-300 flex items-center gap-2 border border-[var(--pd-border)] shadow-sm"
                  >
                    <Download className="h-4 w-4 transition-transform group-hover:-translate-y-1" />
                    PDF
                  </button>
                  <button
                    onClick={notifyUsers}
                    disabled={notifying}
                    className="group px-5 py-3.5 bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[var(--pd-accent)] hover:text-white transition-all duration-300 flex items-center gap-2 border border-[var(--pd-border)] shadow-sm disabled:opacity-50"
                  >
                    <Bell className={cn("h-4 w-4", notifying && "animate-bounce")} />
                    Notifica
                  </button>
                </>
              )}
              <button
                onClick={() => setShowGenerateConfirm(true)}
                disabled={generating}
                className="group px-6 py-3.5 bg-[var(--pd-accent)] text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[var(--pd-accent-hover)] transition-all duration-300 flex items-center gap-2 shadow-lg shadow-[var(--pd-shadow)] active:scale-95 disabled:grayscale"
              >
                <Play className={cn("h-4 w-4", generating && "animate-spin")} />
                Genera Piano
              </button>
              <button
                onClick={() => {
                  setPrefilledShiftData(null)
                  setShowAddShiftModal(true)
                }}
                className="group px-6 py-3.5 bg-green-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-green-700 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-green-100 active:scale-95"
              >
                <UserPlus className="h-4 w-4" />
                Nuovo Turno
              </button>
            </div>
          </div>

          {/* Week Selector Integrated */}
          <div className="mt-10 pt-8 border-t border-[var(--pd-border)] flex flex-col sm:flex-row items-center justify-between gap-6">
            <button
              onClick={() => navigateWeek('prev')}
              className="flex items-center gap-3 px-6 py-3 text-sm font-black uppercase tracking-widest text-[var(--pd-muted)] hover:text-[var(--pd-accent)] hover:bg-[var(--pd-accent-soft)] rounded-2xl transition-all duration-300"
            >
              <ChevronLeft className="h-5 w-5" />
              Precedente
            </button>

            <div className="flex flex-col items-center">
              <div className="px-8 py-3 bg-[var(--pd-surface-muted)] rounded-[2rem] border-2 border-[var(--pd-border)] shadow-inner group transition-all duration-500 hover:border-[var(--pd-accent)]">
                <h2 className="text-xl font-black text-[var(--pd-text)] flex items-center gap-4">
                  <span className="text-[var(--pd-accent)] opacity-40">#</span>
                  {formatDate(weekDays[0])} — {formatDate(weekDays[6])}
                </h2>
              </div>
              {schedule && (
                <span className="mt-3 text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-[0.3em]">
                  Piano Settimanale Attivo
                </span>
              )}
            </div>

            <button
              onClick={() => navigateWeek('next')}
              className="flex items-center gap-3 px-6 py-3 text-sm font-black uppercase tracking-widest text-[var(--pd-muted)] hover:text-[var(--pd-accent)] hover:bg-[var(--pd-accent-soft)] rounded-2xl transition-all duration-300"
            >
              Successiva
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Sidebar Area: Stats & Alerts */}
          <div className="xl:col-span-1 space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-[var(--pd-surface)] p-6 rounded-[2rem] shadow-[var(--pd-shadow)] border border-[var(--pd-border)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Target className="h-12 w-12 text-[var(--pd-accent)]" />
                </div>
                <p className="text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-widest">Copertura Totale</p>
                <h3 className="text-3xl font-black text-[var(--pd-text)] mt-2">
                  {schedule ? "94%" : "0%"}
                </h3>
                <div className="w-full bg-[var(--pd-surface-muted)] h-2 rounded-full mt-4 overflow-hidden">
                  <div className="bg-[var(--pd-accent)] h-full rounded-full" style={{ width: schedule ? '94%' : '0%' }}></div>
                </div>
              </div>

              <div className="bg-[var(--pd-surface)] p-6 rounded-[2rem] shadow-[var(--pd-shadow)] border border-[var(--pd-border)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Users className="h-12 w-12 text-[var(--pd-accent)]" />
                </div>
                <p className="text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-widest">Collaboratori</p>
                <h3 className="text-3xl font-black text-[var(--pd-text)] mt-2">
                  {schedule ? [...new Set(schedule.shifts.map(s => s.userId))].length : 0}
                </h3>
                <p className="text-[10px] font-bold text-[var(--pd-accent)] uppercase mt-2">In servizio questa settimana</p>
              </div>
            </div>

            {/* Availability Status Alert */}
            {missingAvailability.length > 0 ? (
              <div className="bg-amber-50 rounded-[2rem] p-6 border-2 border-amber-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <AlertTriangle className="h-12 w-12 text-amber-600" />
                </div>
                <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  Disp. Mancanti ({missingAvailability.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {missingAvailability.map((username, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-white text-[10px] font-black text-[var(--pd-warning)] uppercase rounded-xl border border-[var(--pd-border)] shadow-sm"
                    >
                      {username}
                    </span>
                  ))}
                </div>
                <p className="mt-6 text-[10px] font-bold text-amber-600/70 italic leading-relaxed">
                  La generazione automatica è più precisa con tutte le disponibilità.
                </p>
              </div>
            ) : (
              <div className="bg-[var(--pd-success-soft)] rounded-[2rem] p-6 border-2 border-green-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--pd-success)] rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Check className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-green-900 uppercase tracking-wider leading-none">Status OK</h3>
                  <p className="text-[10px] font-bold text-[var(--pd-success)] uppercase mt-2">Tutte le disp. inserite</p>
                </div>
              </div>
            )}
          </div>

          {/* Main Area: Schedule Grid */}
          <div className="xl:col-span-3">
            <div className="bg-[var(--pd-surface)] rounded-[3rem] shadow-[var(--pd-shadow)] border border-[var(--pd-border)] overflow-hidden">
              {loading ? (
                <div className="p-12 space-y-8">
                  <Skeleton className="h-12 w-64 rounded-2xl" />
                  <TableSkeleton rows={7} cols={3} />
                </div>
              ) : schedule ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[var(--pd-surface-muted)]/80">
                        <th className="px-8 py-6 text-left text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-[0.3em] border-b border-[var(--pd-border)] w-[180px]">
                          Giorno
                        </th>
                        <th className="px-8 py-6 text-left text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-[0.3em] border-b border-[var(--pd-border)]">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-[var(--pd-accent-soft)] flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--pd-accent)]" />
                            </span>
                            Turno Pranzo
                          </div>
                        </th>
                        <th className="px-8 py-6 text-left text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-[0.3em] border-b border-[var(--pd-border)]">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-[var(--pd-accent-soft)] flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--pd-accent)]" />
                            </span>
                            Turno Cena
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--pd-border)]">
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

                        return (
                          <tr
                            key={index}
                            className={cn(
                              'group transition-colors',
                              isFullClosureDay ? 'bg-[var(--pd-accent-soft)]/35 hover:bg-[var(--pd-accent-soft)]/50' : 'hover:bg-[var(--pd-surface-muted)]/80'
                            )}
                          >
                            <td className="px-8 py-8 border-r border-[var(--pd-border)]">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-lg font-black text-[var(--pd-text)] leading-none">
                                  {getDayName(dayOfWeek)}
                                </span>
                                <span className="text-[11px] font-black text-[var(--pd-accent)]/50 uppercase tracking-widest">
                                  {formatDate(day)}
                                </span>
                                {holidayBadges.length > 0 && (
                                  <div className="flex flex-col gap-1 mt-1">
                                    {holidayBadges.map((label) => (
                                      <span
                                        key={label}
                                        className={cn(
                                          'inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-tight border',
                                          isFullClosureDay
                                            ? 'bg-[var(--pd-accent-soft)] text-orange-800 border-[var(--pd-accent)]'
                                            : 'bg-amber-50 text-amber-800 border-[var(--pd-border)]'
                                        )}
                                      >
                                        <Sparkles className="h-3 w-3 shrink-0 opacity-80" />
                                        {label}
                                      </span>
                                    ))}
                                    {holidayDescriptions.length > 0 && (
                                      <span className="text-[10px] font-bold text-[var(--pd-muted)] leading-snug max-w-[220px]">
                                        {holidayDescriptions.join(' · ')}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-8 align-top bg-white/40 group-hover:bg-transparent transition-colors">
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
                            <td className="px-8 py-8 align-top">
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
                <div className="text-center py-32 relative overflow-hidden">
                  <div className="absolute inset-0 bg-transparent"></div>
                  <div className="relative z-10">
                    <div className="w-24 h-24 bg-[var(--pd-surface-muted)] rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-[var(--pd-muted)]/50">
                      <Calendar className="h-12 w-12" />
                    </div>
                    <h3 className="text-2xl font-black text-[var(--pd-text)] tracking-tight">Nessun piano generato</h3>
                    <p className="text-[var(--pd-muted)] font-medium mt-3 max-w-xs mx-auto">Configura le disponibilità e premi il tasto sopra per iniziare.</p>
                    <button
                      onClick={() => setShowGenerateConfirm(true)}
                      className="mt-10 px-8 py-4 bg-[var(--pd-accent)] text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[var(--pd-shadow)] hover:bg-[var(--pd-accent-hover)] transition-all active:scale-95"
                    >
                      Genera Ora
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coverage Details Section */}
        {schedule && (
          <div className="mt-8">
            <CoverageReport
              schedule={schedule}
              shiftLimits={shiftLimits}
              currentWeek={currentWeek}
            />
          </div>
        )}
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
            <div className="bg-[var(--pd-danger-soft)]/50 p-5 rounded-2xl border border-[var(--pd-border)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[var(--pd-danger-soft)]0 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-red-200">
                  {selectedShift.user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-black text-red-900 text-sm uppercase tracking-wider">
                    {selectedShift.user.username}
                  </h4>
                  <p className="text-xs text-[var(--pd-danger)] font-medium">Sarà rimosso dal turno</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Giorno</p>
                  <p className="font-black text-red-900">{getDayName(selectedShift.dayOfWeek)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Turno</p>
                  <p className="font-black text-red-900">{getShiftTypeName(selectedShift.shiftType)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Ruolo</p>
                  <p className="font-black text-red-900">{getRoleName(selectedShift.role)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Orario</p>
                  <p className="font-black text-red-900">{selectedShift.startTime} - {selectedShift.endTime}</p>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-3">
                Motivo (opzionale)
              </label>
              <textarea
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                rows={3}
                className="w-full border-2 border-[var(--pd-border)] rounded-2xl px-5 py-4 text-[var(--pd-text)] placeholder-[var(--pd-muted)]/50 bg-[var(--pd-surface-muted)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--pd-danger)] focus:border-[var(--pd-danger)] focus:bg-[var(--pd-surface)] transition-all resize-none"
                placeholder="Motivo della rimozione..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--pd-border)]">
              <button
                type="button"
                onClick={() => setShowRemoveModal(false)}
                className="px-6 py-3 text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest hover:bg-[var(--pd-surface-muted)] rounded-xl transition-all"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmRemoveShift}
                disabled={removing}
                className="px-8 py-3 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-2"
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
            <div className="bg-[var(--pd-accent-soft)]/50 p-5 rounded-2xl border border-[var(--pd-border)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[var(--pd-accent)] rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[var(--pd-shadow)]">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-blue-900 text-sm uppercase tracking-wider">
                    {editingShift.user.username}
                  </h4>
                  <p className="text-xs text-[var(--pd-accent)] font-medium">Modifica orario di inizio</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-accent)] uppercase tracking-wider">Giorno</p>
                  <p className="font-black text-blue-900">{getDayName(editingShift.dayOfWeek)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-accent)] uppercase tracking-wider">Turno</p>
                  <p className="font-black text-blue-900">{getShiftTypeName(editingShift.shiftType)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-accent)] uppercase tracking-wider">Ruolo</p>
                  <p className="font-black text-blue-900">{getRoleName(editingShift.role)}</p>
                </div>
              </div>
            </div>

            {/* Start Time Selection */}
            <div>
              <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-3">
                Orario Inizio
              </label>
              <select
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full border-2 border-[var(--pd-border)] rounded-2xl px-5 py-4 text-[var(--pd-text)] bg-[var(--pd-surface-muted)] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-[var(--pd-surface)] transition-all appearance-none cursor-pointer"
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
                className="px-6 py-3 text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest hover:bg-[var(--pd-surface-muted)] rounded-xl transition-all"
              >
                Annulla
              </button>
              <button
                onClick={confirmTimeUpdate}
                disabled={!newStartTime || updatingTime}
                className="px-8 py-3 bg-[var(--pd-accent)] text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--pd-shadow)] hover:bg-[var(--pd-accent-hover)] transition-all disabled:opacity-50 flex items-center gap-2"
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
            <div className="bg-[var(--pd-accent-soft)]/50 p-5 rounded-2xl border border-[var(--pd-border)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[var(--pd-accent)] rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[var(--pd-shadow)]">
                  <Edit className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-[var(--pd-text)] text-sm uppercase tracking-wider">
                    {editingRoleShift.user.username}
                  </h4>
                  <p className="text-xs text-[var(--pd-accent)] font-medium">Cambia ruolo per questo turno</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] uppercase tracking-wider">Giorno</p>
                  <p className="font-black text-[var(--pd-text)]">{getDayName(editingRoleShift.dayOfWeek)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] uppercase tracking-wider">Turno</p>
                  <p className="font-black text-[var(--pd-text)]">{getShiftTypeName(editingRoleShift.shiftType)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] uppercase tracking-wider">Ruolo Attuale</p>
                  <p className="font-black text-[var(--pd-text)]">{getRoleName(editingRoleShift.role)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] uppercase tracking-wider">Ruolo Principale</p>
                  <p className="font-black text-[var(--pd-text)]">{getRoleName(editingRoleShift.user.primaryRole)}</p>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-3">
                Nuovo Ruolo
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full border-2 border-[var(--pd-border)] rounded-2xl px-5 py-4 text-[var(--pd-text)] bg-[var(--pd-surface-muted)] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all appearance-none cursor-pointer"
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
                className="px-6 py-3 text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest hover:bg-[var(--pd-surface-muted)] rounded-xl transition-all"
              >
                Annulla
              </button>
              <button
                onClick={confirmRoleUpdate}
                disabled={!newRole || updatingRole}
                className="px-8 py-3 bg-[var(--pd-accent)] text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--pd-shadow)] hover:bg-[var(--pd-accent-hover)] transition-all disabled:opacity-50 flex items-center gap-2"
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
              <p className="text-amber-600"><strong>⚠️ Attenzione:</strong> {missingAvailability.length} utenti senza disponibilità</p>
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
  gaps,
  shiftLimits,
  holidays,
  onRemoveShift,
  onEditTime,
  onEditRole,
  onQuickAdd
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
  // Check if this day/shift is a holiday
  const isHoliday = holidays.some(h => {
    const holidayDate = new Date(h.date).toISOString().split('T')[0]
    const currentDate = day.toISOString().split('T')[0]
    return holidayDate === currentDate && (
      h.closureType === 'FULL_DAY' ||
      (h.closureType === 'PRANZO_ONLY' && shiftType === 'PRANZO') ||
      (h.closureType === 'CENA_ONLY' && shiftType === 'CENA')
    )
  })

  if (isHoliday) {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 border border-[var(--pd-border)]">
          🔒 CHIUSO
        </span>
      </div>
    )
  }

  // Group by role
  const byRole = shifts.reduce((acc, shift) => {
    if (!acc[shift.role]) acc[shift.role] = []
    acc[shift.role].push(shift)
    return acc
  }, {} as Record<Role, ScheduleShift[]>)

  // Get all roles that should be displayed (configured + assigned)
  const allRoles = new Set<Role>()

  // Add roles from shift limits
  shiftLimits.forEach(limit => {
    if (limit.dayOfWeek === dayOfWeek && limit.shiftType === shiftType && limit.requiredStaff > 0) {
      allRoles.add(limit.role as Role)
    }
  })

  // Add roles from assigned shifts
  shifts.forEach(shift => allRoles.add(shift.role))

  if (allRoles.size === 0) {
    return <span className="text-[var(--pd-muted)] text-sm">Nessuno assegnato</span>
  }

  return (
    <div className="space-y-2">
      {Array.from(allRoles).map((role) => {
        const roleShifts = byRole[role] || []
        const limit = shiftLimits.find(l =>
          l.dayOfWeek === dayOfWeek &&
          l.shiftType === shiftType &&
          l.role === role
        )
        const gap = gaps.find(g =>
          g.dayOfWeek === dayOfWeek &&
          g.shiftType === shiftType &&
          g.role === role
        )

        const required = limit?.requiredStaff || 0
        const assigned = roleShifts.length
        const missing = Math.max(0, required - assigned)

        return (
          <div key={role}>
            <div className="flex items-center justify-between mb-1 group/role">
              <div className="flex items-center gap-2">
                <div className="text-xs font-medium text-[var(--pd-text)]">
                  {getRoleName(role)} ({assigned}/{required})
                </div>
                {onQuickAdd && (
                  <button
                    onClick={() => onQuickAdd(dayOfWeek, shiftType, role)}
                    className="inline-flex items-center justify-center w-5 h-5 md:w-4 md:h-4 rounded-full bg-[var(--pd-accent)] text-white hover:bg-[var(--pd-accent-hover)] transition-all opacity-100 md:opacity-0 md:group-hover/role:opacity-100"
                    title={`Aggiungi ${getRoleName(role)}`}
                  >
                    <UserPlus className="h-3 w-3 md:h-2.5 md:w-2.5" />
                  </button>
                )}
              </div>
              {missing > 0 && (
                <span className="text-xs font-medium text-[var(--pd-danger)] bg-[var(--pd-danger-soft)] px-2 py-0.5 rounded">
                  -{missing}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {roleShifts.map((shift) => {
                const transportIcon = getTransportIcon(shift.user, shift.role)
                return (
                  <div
                    key={shift.id}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--pd-accent-soft)] text-orange-800 group relative"
                  >
                    <span className="flex items-center gap-1">
                      {shift.user.username}
                      {transportIcon}
                      <span className="text-xs text-[var(--pd-accent)] ml-1">
                        {shift.startTime}
                      </span>
                    </span>
                    <div className="flex items-center gap-1 ml-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {onEditTime && (
                        <button
                          onClick={() => onEditTime(shift)}
                          className="text-[var(--pd-accent)] hover:text-[var(--pd-accent)] p-1"
                          title="Modifica orari"
                        >
                          <Clock className="h-3 w-3" />
                        </button>
                      )}
                      {onEditRole && (
                        <button
                          onClick={() => onEditRole(shift)}
                          className="text-[var(--pd-accent)] hover:text-[var(--pd-text)] p-1"
                          title="Modifica ruolo"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      )}
                      {onRemoveShift && (
                        <button
                          onClick={() => onRemoveShift(shift)}
                          className="text-[var(--pd-danger)] hover:text-red-800 p-1"
                          title="Rimuovi dal turno"
                        >
                          <UserMinus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {missing > 0 && (
                <div className="inline-flex items-center gap-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-[var(--pd-danger)] border border-[var(--pd-border)] border-dashed">
                    Mancano {missing}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CoverageReport({
  schedule,
  shiftLimits,
  currentWeek
}: {
  schedule: Schedule
  shiftLimits: { dayOfWeek: number; shiftType: string; role: string; requiredStaff: number }[]
  currentWeek: Date
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [coverageData, setCoverageData] = useState<{
    userStats: Array<{
      userId: string
      username: string
      primaryRole: string | null
      availabilitiesEntered: number
      shiftsAssigned: number
      assignmentPercentage: number
    }>
    global: {
      totalAvailabilities: number
      totalAssignments: number
      assignmentPercentage: number
    }
  } | null>(null)

  useEffect(() => {
    fetchCoverageData()
  }, [schedule, currentWeek])

  const fetchCoverageData = async () => {
    try {
      const response = await fetch(`/api/admin/schedule/coverage-stats?weekStart=${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        setCoverageData(data)
      }
    } catch (error) {
      console.error('Error fetching coverage stats:', error)
    }
  }

  if (!coverageData) return null

  return (
    <div className="bg-[var(--pd-surface)] rounded-xl shadow-md border border-[var(--pd-border)] overflow-hidden">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 bg-[var(--pd-surface-muted)] hover:bg-[var(--pd-surface-muted)] transition-all duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Icon Box */}
            <div className="w-12 h-12 bg-[var(--pd-accent)] rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>

            {/* Title */}
            <div className="text-left">
              <h3 className="text-lg font-bold text-[var(--pd-text)]">
                Resoconto Assegnamento Turni per Persona
              </h3>
              <p className="text-sm text-[var(--pd-muted)] font-medium">
                Statistiche di copertura disponibilità
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* Global Stats */}
            <div className="bg-[var(--pd-surface)] rounded-lg px-4 py-2 border-2 border-[var(--pd-border)]">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--pd-accent)]">
                  {coverageData.global.assignmentPercentage}%
                </div>
                <div className="text-xs text-[var(--pd-muted)]">
                  {coverageData.global.totalAssignments}/{coverageData.global.totalAvailabilities} assegnati
                </div>
              </div>
            </div>

            {/* Expand Icon */}
            <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="h-6 w-6 text-[var(--pd-muted)]" />
            </div>
          </div>
        </div>
      </button>

      {/* User Stats Table - Expandable */}
      {isExpanded && (
        <div className="border-t border-[var(--pd-border)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[var(--pd-surface-muted)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--pd-muted)] uppercase tracking-wider">
                    Dipendente
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[var(--pd-muted)] uppercase tracking-wider">
                    Ruolo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[var(--pd-muted)] uppercase tracking-wider">
                    Disponibilità
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[var(--pd-muted)] uppercase tracking-wider">
                    Assegnati
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[var(--pd-muted)] uppercase tracking-wider">
                    % Assegnamento
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[var(--pd-surface)] divide-y divide-gray-200">
                {coverageData.userStats.map((user) => (
                  <tr key={user.userId} className="hover:bg-[var(--pd-surface-muted)] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-[var(--pd-text)]">
                        {user.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-[var(--pd-muted)]">
                        {user.primaryRole || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-[var(--pd-text)]">
                        {user.availabilitiesEntered}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-[var(--pd-text)]">
                        {user.shiftsAssigned}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-20 bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-300 ${user.assignmentPercentage >= 80 ? 'bg-[var(--pd-success)]' :
                              user.assignmentPercentage >= 50 ? 'bg-[var(--pd-warning)]' :
                                'bg-[var(--pd-danger-soft)]0'
                              }`}
                            style={{ width: `${Math.min(100, user.assignmentPercentage)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold min-w-[45px] ${user.assignmentPercentage >= 80 ? 'text-[var(--pd-success)]' :
                          user.assignmentPercentage >= 50 ? 'text-yellow-600' :
                            'text-[var(--pd-danger)]'
                          }`}>
                          {user.assignmentPercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
