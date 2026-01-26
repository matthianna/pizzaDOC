'use client'

import { useState, useEffect } from 'react'
import { addWeeks, subWeeks } from 'date-fns'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, ChevronLeft, ChevronRight, Play, Download, Trash2, AlertTriangle, UserPlus, Car, Bike, UserMinus, Clock, X, BarChart3, Edit, ChevronDown, ChevronUp, Bell, Target, TrendingUp, Users, Check } from 'lucide-react'
import { getNextWeekStart, getWeekDays, formatDate, getDayOfWeek, getWeekStart } from '@/lib/date-utils'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { Role, ShiftType, TransportType } from '@prisma/client'
import { AddShiftModal } from '@/components/admin/add-shift-modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Modal } from '@/components/ui/modal'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

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

export default function AdminSchedulePage() {
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
      const response = await fetch(`/api/admin/schedule/${currentWeek.toISOString()}`)
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
      const weekStart = new Date(currentWeek)
      const weekEnd = new Date(currentWeek)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const response = await fetch(`/api/holidays?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`)
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
      const response = await fetch(`/api/admin/missing-availability?weekStart=${currentWeek.toISOString()}`)
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
        alert(`Piano generato con successo! ${data.shiftsGenerated} turni assegnati.`)
      } else {
        alert('Errore durante la generazione del piano')
      }
    } catch (error) {
      console.error('Error generating schedule:', error)
      alert('Errore durante la generazione del piano')
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
        alert('Piano eliminato con successo')
      } else {
        alert('Errore durante l\'eliminazione del piano')
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('Errore durante l\'eliminazione del piano')
    }
  }

  const notifyUsers = async () => {
    if (!schedule) {
      alert('Nessun piano disponibile per questa settimana')
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
          alert(`✅ ${data.message || `Notifiche inviate con successo a ${data.successful || 0} utenti!`}`)
        } else {
          alert(`⚠️ ${data.error || 'Errore durante l\'invio delle notifiche'}`)
        }
      } else {
        const errorMessage = data.error || 'Errore durante l\'invio delle notifiche'
        let details = data.message ? `\n\n${data.message}` : ''
        if (data.debug) {
          details += `\n\nDebug:\nCercato: ${data.debug.searched}\nEsistenti: ${data.debug.existing.join(', ')}`
        }
        alert(`❌ ${errorMessage}${details}`)
      }
    } catch (error: any) {
      console.error('Error sending notifications:', error)
      alert(`❌ Errore durante l'invio delle notifiche: ${error.message || 'Errore di connessione'}`)
    } finally {
      setNotifying(false)
    }
  }

  const exportToPDF = async () => {
    try {
      const response = await fetch(`/api/admin/schedule/${currentWeek.toISOString()}/export-pdf`)
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
        alert(`❌ Errore durante l'esportazione PDF: ${error.error || error.details || 'Errore sconosciuto'}`)
      }
    } catch (error: any) {
      console.error('Error exporting PDF:', error)
      alert(`❌ Errore durante l'esportazione PDF: ${error.message || 'Errore di connessione'}`)
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

        alert(`Turno di ${result.username} rimosso definitivamente.`)
      } else {
        const error = await response.json()
        alert(error.error || 'Errore nella rimozione')
      }
    } catch (error) {
      console.error('Error removing shift:', error)
      alert('Errore nella rimozione del turno')
    } finally {
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
        alert(error.error || 'Errore nell\'aggiornamento degli orari')
      }
    } catch (error) {
      console.error('Error updating shift times:', error)
      alert('Errore nell\'aggiornamento degli orari')
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
        alert(error.error || 'Errore nell\'aggiornamento del ruolo')
      }
    } catch (error) {
      console.error('Error updating shift role:', error)
      alert('Errore nell\'aggiornamento del ruolo')
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
      <div className="space-y-8 max-w-[1600px] mx-auto pb-20">
        {/* Advanced Header */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60"></div>
          
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-orange-600 rounded-3xl shadow-xl shadow-orange-100 text-white transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                <Calendar className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none">Piano di Lavoro</h1>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Gestione Settimanale Operativa
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {schedule && (
                <>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="group px-5 py-3.5 bg-red-50 text-red-600 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all duration-300 flex items-center gap-2 border border-red-100 shadow-sm"
                  >
                    <Trash2 className="h-4 w-4 transition-transform group-hover:scale-110" />
                    Elimina
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="group px-5 py-3.5 bg-blue-50 text-blue-600 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-blue-600 hover:text-white transition-all duration-300 flex items-center gap-2 border border-blue-100 shadow-sm"
                  >
                    <Download className="h-4 w-4 transition-transform group-hover:-translate-y-1" />
                    PDF
                  </button>
                  <button
                    onClick={notifyUsers}
                    disabled={notifying}
                    className="group px-5 py-3.5 bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-600 hover:text-white transition-all duration-300 flex items-center gap-2 border border-indigo-100 shadow-sm disabled:opacity-50"
                  >
                    <Bell className={cn("h-4 w-4", notifying && "animate-bounce")} />
                    Notifica
                  </button>
                </>
              )}
              <button
                onClick={() => setShowGenerateConfirm(true)}
                disabled={generating}
                className="group px-6 py-3.5 bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-orange-700 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-orange-100 active:scale-95 disabled:grayscale"
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
          <div className="mt-10 pt-8 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-6">
            <button
              onClick={() => navigateWeek('prev')}
              className="flex items-center gap-3 px-6 py-3 text-sm font-black uppercase tracking-widest text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-2xl transition-all duration-300"
            >
              <ChevronLeft className="h-5 w-5" />
              Precedente
            </button>

            <div className="flex flex-col items-center">
              <div className="px-8 py-3 bg-gray-50 rounded-[2rem] border-2 border-gray-100 shadow-inner group transition-all duration-500 hover:border-orange-200">
                <h2 className="text-xl font-black text-gray-900 flex items-center gap-4">
                  <span className="text-orange-600 opacity-40">#</span>
                  {formatDate(weekDays[0])} — {formatDate(weekDays[6])}
                </h2>
              </div>
              {schedule && (
                <span className="mt-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
                  Piano Settimanale Attivo
                </span>
              )}
            </div>

            <button
              onClick={() => navigateWeek('next')}
              className="flex items-center gap-3 px-6 py-3 text-sm font-black uppercase tracking-widest text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-2xl transition-all duration-300"
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
              <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-gray-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Target className="h-12 w-12 text-orange-600" />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Copertura Totale</p>
                <h3 className="text-3xl font-black text-gray-900 mt-2">
                  {schedule ? "94%" : "0%"}
                </h3>
                <div className="w-full bg-gray-100 h-2 rounded-full mt-4 overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full" style={{ width: schedule ? '94%' : '0%' }}></div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-gray-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Users className="h-12 w-12 text-blue-600" />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Collaboratori</p>
                <h3 className="text-3xl font-black text-gray-900 mt-2">
                  {schedule ? [...new Set(schedule.shifts.map(s => s.userId))].length : 0}
                </h3>
                <p className="text-[10px] font-bold text-blue-600 uppercase mt-2">In servizio questa settimana</p>
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
                      className="px-3 py-1.5 bg-white text-[10px] font-black text-amber-700 uppercase rounded-xl border border-amber-200 shadow-sm"
                    >
                      {username}
                    </span>
                  ))}
                </div>
                <p className="mt-6 text-[10px] font-bold text-amber-600/70 italic leading-relaxed">
                  💡 La generazione automatica è più precisa con tutte le disponibilità.
                </p>
              </div>
            ) : (
              <div className="bg-green-50 rounded-[2rem] p-6 border-2 border-green-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Check className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-green-900 uppercase tracking-wider leading-none">Status OK</h3>
                  <p className="text-[10px] font-bold text-green-600 uppercase mt-2">Tutte le disp. inserite</p>
                </div>
              </div>
            )}
          </div>

          {/* Main Area: Schedule Grid */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-[3rem] shadow-soft border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="p-12 space-y-8">
                  <Skeleton className="h-12 w-64 rounded-2xl" />
                  <TableSkeleton rows={7} cols={3} />
                </div>
              ) : schedule ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 w-[180px]">
                          Giorno
                        </th>
                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-orange-100 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            </span>
                            Turno Pranzo
                          </div>
                        </th>
                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            </span>
                            Turno Cena
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {weekDays.map((day, index) => {
                        const dayOfWeek = getDayOfWeek(day)
                        const pranzoCrew = shiftGroups[`${dayOfWeek}-PRANZO`] || []
                        const cenaCrew = shiftGroups[`${dayOfWeek}-CENA`] || []

                        return (
                          <tr key={index} className="group hover:bg-gray-50/50 transition-colors">
                            <td className="px-8 py-8 border-r border-gray-50">
                              <div className="flex flex-col gap-1">
                                <span className="text-lg font-black text-gray-900 leading-none">
                                  {getDayName(dayOfWeek)}
                                </span>
                                <span className="text-[11px] font-black text-orange-600/50 uppercase tracking-widest mt-1">
                                  {formatDate(day)}
                                </span>
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
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-50/30 to-transparent"></div>
                  <div className="relative z-10">
                    <div className="w-24 h-24 bg-gray-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-gray-300">
                      <Calendar className="h-12 w-12" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Nessun piano generato</h3>
                    <p className="text-gray-500 font-medium mt-3 max-w-xs mx-auto">Configura le disponibilità e premi il tasto sopra per iniziare.</p>
                    <button
                      onClick={() => setShowGenerateConfirm(true)}
                      className="mt-10 px-8 py-4 bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all active:scale-95"
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
            <div className="bg-gradient-to-br from-red-50 to-red-100/50 p-5 rounded-2xl border border-red-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-red-200">
                  {selectedShift.user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-black text-red-900 text-sm uppercase tracking-wider">
                    {selectedShift.user.username}
                  </h4>
                  <p className="text-xs text-red-600 font-medium">Sarà rimosso dal turno</p>
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
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                Motivo (opzionale)
              </label>
              <textarea
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                rows={3}
                className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-900 placeholder-gray-400 bg-gray-50 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:bg-white transition-all resize-none"
                placeholder="Motivo della rimozione..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowRemoveModal(false)}
                className="px-6 py-3 text-xs font-black text-gray-600 uppercase tracking-widest hover:bg-gray-100 rounded-xl transition-all"
              >
                Annulla
              </button>
              <button
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
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-5 rounded-2xl border border-blue-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-200">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-blue-900 text-sm uppercase tracking-wider">
                    {editingShift.user.username}
                  </h4>
                  <p className="text-xs text-blue-600 font-medium">Modifica orario di inizio</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Giorno</p>
                  <p className="font-black text-blue-900">{getDayName(editingShift.dayOfWeek)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Turno</p>
                  <p className="font-black text-blue-900">{getShiftTypeName(editingShift.shiftType)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Ruolo</p>
                  <p className="font-black text-blue-900">{getRoleName(editingShift.role)}</p>
                </div>
              </div>
            </div>

            {/* Start Time Selection */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                Orario Inizio
              </label>
              <select
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-900 bg-gray-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
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

            <p className="text-xs text-gray-500 font-medium bg-gray-50 px-4 py-3 rounded-xl">
              💡 Gli orari di fine sono fissi per tutti i turni
            </p>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowTimeEditModal(false)}
                className="px-6 py-3 text-xs font-black text-gray-600 uppercase tracking-widest hover:bg-gray-100 rounded-xl transition-all"
              >
                Annulla
              </button>
              <button
                onClick={confirmTimeUpdate}
                disabled={!newStartTime || updatingTime}
                className="px-8 py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
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
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-5 rounded-2xl border border-purple-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-purple-200">
                  <Edit className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-purple-900 text-sm uppercase tracking-wider">
                    {editingRoleShift.user.username}
                  </h4>
                  <p className="text-xs text-purple-600 font-medium">Cambia ruolo per questo turno</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Giorno</p>
                  <p className="font-black text-purple-900">{getDayName(editingRoleShift.dayOfWeek)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Turno</p>
                  <p className="font-black text-purple-900">{getShiftTypeName(editingRoleShift.shiftType)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Ruolo Attuale</p>
                  <p className="font-black text-purple-900">{getRoleName(editingRoleShift.role)}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Ruolo Principale</p>
                  <p className="font-black text-purple-900">{getRoleName(editingRoleShift.user.primaryRole)}</p>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                Nuovo Ruolo
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-900 bg-gray-50 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all appearance-none cursor-pointer"
              >
                <option value="">Seleziona ruolo</option>
                <option value="FATTORINO">{getRoleName('FATTORINO')}</option>
                <option value="CUCINA">{getRoleName('CUCINA')}</option>
                <option value="SALA">{getRoleName('SALA')}</option>
                <option value="PIZZAIOLO">{getRoleName('PIZZAIOLO')}</option>
              </select>
            </div>

            <p className="text-xs text-gray-500 font-medium bg-gray-50 px-4 py-3 rounded-xl">
              💡 Verifica che l'utente possa svolgere questo ruolo
            </p>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowRoleEditModal(false)}
                className="px-6 py-3 text-xs font-black text-gray-600 uppercase tracking-widest hover:bg-gray-100 rounded-xl transition-all"
              >
                Annulla
              </button>
              <button
                onClick={confirmRoleUpdate}
                disabled={!newRole || updatingRole}
                className="px-8 py-3 bg-purple-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
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
            <p><strong>Settimana:</strong> {formatDate(currentWeek)} - {formatDate(new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000))}</p>
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
            <p><strong>Settimana:</strong> {formatDate(currentWeek)} - {formatDate(new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000))}</p>
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
      return <Car className="h-3 w-3 text-blue-600" />
    case 'SCOOTER':
      return <Bike className="h-3 w-3 text-green-600" />
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
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 border border-red-200">
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
    return <span className="text-gray-400 text-sm">Nessuno assegnato</span>
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
                <div className="text-xs font-medium text-gray-700">
                  {getRoleName(role)} ({assigned}/{required})
                </div>
                {onQuickAdd && (
                  <button
                    onClick={() => onQuickAdd(dayOfWeek, shiftType, role)}
                    className="inline-flex items-center justify-center w-5 h-5 md:w-4 md:h-4 rounded-full bg-orange-600 text-white hover:bg-orange-700 transition-all opacity-100 md:opacity-0 md:group-hover/role:opacity-100"
                    title={`Aggiungi ${getRoleName(role)}`}
                  >
                    <UserPlus className="h-3 w-3 md:h-2.5 md:w-2.5" />
                  </button>
                )}
              </div>
              {missing > 0 && (
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
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
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 group relative"
                  >
                    <span className="flex items-center gap-1">
                      {shift.user.username}
                      {transportIcon}
                      <span className="text-xs text-orange-600 ml-1">
                        {shift.startTime}
                      </span>
                    </span>
                    <div className="flex items-center gap-1 ml-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {onEditTime && (
                        <button
                          onClick={() => onEditTime(shift)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Modifica orari"
                        >
                          <Clock className="h-3 w-3" />
                        </button>
                      )}
                      {onEditRole && (
                        <button
                          onClick={() => onEditRole(shift)}
                          className="text-purple-600 hover:text-purple-800 p-1"
                          title="Modifica ruolo"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      )}
                      {onRemoveShift && (
                        <button
                          onClick={() => onRemoveShift(shift)}
                          className="text-red-600 hover:text-red-800 p-1"
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
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600 border border-red-200 border-dashed">
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
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 bg-gradient-to-r from-blue-50 via-white to-blue-50 hover:from-blue-100 hover:via-blue-50 hover:to-blue-100 transition-all duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Icon Box */}
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>

            {/* Title */}
            <div className="text-left">
              <h3 className="text-lg font-bold text-gray-900">
                Resoconto Assegnamento Turni per Persona
              </h3>
              <p className="text-sm text-gray-600 font-medium">
                Statistiche di copertura disponibilità
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* Global Stats */}
            <div className="bg-white rounded-lg px-4 py-2 border-2 border-blue-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {coverageData.global.assignmentPercentage}%
                </div>
                <div className="text-xs text-gray-600">
                  {coverageData.global.totalAssignments}/{coverageData.global.totalAvailabilities} assegnati
                </div>
              </div>
            </div>

            {/* Expand Icon */}
            <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="h-6 w-6 text-gray-400" />
            </div>
          </div>
        </div>
      </button>

      {/* User Stats Table - Expandable */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dipendente
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ruolo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Disponibilità
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assegnati
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % Assegnamento
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {coverageData.userStats.map((user) => (
                  <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {user.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-gray-600">
                        {user.primaryRole || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-gray-900">
                        {user.availabilitiesEntered}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-gray-900">
                        {user.shiftsAssigned}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-20 bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-300 ${user.assignmentPercentage >= 80 ? 'bg-green-500' :
                              user.assignmentPercentage >= 50 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                            style={{ width: `${Math.min(100, user.assignmentPercentage)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold min-w-[45px] ${user.assignmentPercentage >= 80 ? 'text-green-600' :
                          user.assignmentPercentage >= 50 ? 'text-yellow-600' :
                            'text-red-600'
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
