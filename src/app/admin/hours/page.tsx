'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { it } from 'date-fns/locale'
import { MainLayout } from '@/components/layout/main-layout'
import { Clock, Check, X, AlertCircle, Edit2, ChevronDown, User, Plus, Search } from 'lucide-react'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { formatDate, shiftCalendarDateUtc } from '@/lib/date-utils'
import { Role, ShiftType, HoursStatus } from '@prisma/client'
import { Select as ReactSelect } from '@/components/ui/react-select'
import { TableSkeleton, CardSkeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { useHaptics } from '@/hooks/use-haptics'
import {
  ADMIN_WORKED_TIME_INPUT_STEP_SEC,
  adminWorkedNativeTimeBounds,
  pickInitialAdminWorkedTimes,
  validateAdminWorkedTimes,
} from '@/lib/admin-worked-time-rules'

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
}

interface WorkedHours {
  id: string
  shiftId: string
  startTime: string
  endTime: string
  totalHours: number
  status: HoursStatus
  rejectionReason?: string
  submittedAt: string
  reviewedAt?: string
  user: {
    id: string
    username: string
    primaryRole: Role
  }
  shift: Shift
}

interface MissingShiftRow {
  shiftId: string
  workedHoursId: string | null
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  weekStart: string
  shiftDate: string
  hoursStatus: string | null
}

interface MissingUserGroup {
  userId: string
  username: string
  primaryRole: Role
  shifts: MissingShiftRow[]
}

export default function AdminHoursPage() {
  const [workedHours, setWorkedHours] = useState<WorkedHours[]>([])
  const [filterStatus, setFilterStatus] = useState<HoursStatus | 'ALL'>('PENDING')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [editingHours, setEditingHours] = useState<WorkedHours | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [hourModalError, setHourModalError] = useState<string | null>(null)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [missingByUser, setMissingByUser] = useState<MissingUserGroup[]>([])
  const [missingLoading, setMissingLoading] = useState(false)
  const [creatingShift, setCreatingShift] = useState<{
    shiftId: string
    workedHoursId: string | null
    username: string
    shiftType: ShiftType
    role: Role
    dayOfWeek: number
    weekStart: string
    plannedStart: string
    plannedEnd: string
    shiftDateIso: string
    hoursStatus: string | null
  } | null>(null)

  const { lightClick, success: successClick } = useHaptics()

  const yearOptions = (() => {
    const y = new Date().getFullYear()
    const from = Math.min(2023, y - 1)
    const to = Math.max(y + 1, 2027)
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  })()

  useEffect(() => {
    fetchWorkedHours()
  }, [filterStatus, selectedMonth, selectedYear])

  useEffect(() => {
    fetchMissingShifts()
  }, [])

  const fetchMissingShifts = async () => {
    setMissingLoading(true)
    try {
      const response = await fetch('/api/admin/hours-summary/missing', {
        cache: 'no-store',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setMissingByUser(Array.isArray(data.missingHours) ? data.missingHours : [])
      } else {
        setMissingByUser([])
      }
    } catch (e) {
      console.error(e)
      setMissingByUser([])
    } finally {
      setMissingLoading(false)
    }
  }

  const fetchWorkedHours = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams()
      if (selectedMonth === 0) {
        params.set('allMonths', '1')
      } else {
        params.set('month', String(selectedMonth))
        params.set('year', String(selectedYear))
      }
      if (filterStatus !== 'ALL') {
        params.set('status', filterStatus)
      }

      const response = await fetch(`/api/admin/hours?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setWorkedHours(Array.isArray(data) ? data : [])
      } else {
        let msg = 'Impossibile caricare le ore'
        try {
          const err = await response.json()
          if (typeof err?.error === 'string') msg = err.error
        } catch {
          /* ignore */
        }
        setFetchError(msg)
        setWorkedHours([])
      }
    } catch (error) {
      console.error('Error fetching worked hours:', error)
      setFetchError('Errore di connessione')
      setWorkedHours([])
    } finally {
      setLoading(false)
    }
  }

  const approveHours = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/hours/${id}/approve`, {
        method: 'POST'
      })

      if (response.ok) {
        successClick()
        fetchWorkedHours()
        fetchMissingShifts()
      } else {
        console.error('Errore durante l\'approvazione')
      }
    } catch (error) {
      console.error('Error approving hours:', error)
    }
  }

  const rejectHours = async (id: string, reason: string) => {
    try {
      const response = await fetch(`/api/admin/hours/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        setRejectingId(null)
        setRejectReason('')
        successClick()
        fetchWorkedHours()
        fetchMissingShifts()
      } else {
        console.error('Errore durante il rifiuto')
      }
    } catch (error) {
      console.error('Error rejecting hours:', error)
    }
  }

  const openEditModal = (hours: WorkedHours) => {
    lightClick()
    setHourModalError(null)
    setCreatingShift(null)
    setEditingHours(hours)
    const pick = pickInitialAdminWorkedTimes(
      hours.shift.shiftType,
      hours.startTime,
      hours.endTime
    )
    setEditStartTime(pick.start)
    setEditEndTime(pick.end)
  }

  const openCreateShiftModal = (user: MissingUserGroup, row: MissingShiftRow) => {
    lightClick()
    setHourModalError(null)
    setEditingHours(null)
    setCreatingShift({
      shiftId: row.shiftId,
      workedHoursId: row.workedHoursId,
      username: user.username,
      shiftType: row.shiftType,
      role: row.role,
      dayOfWeek: row.dayOfWeek,
      weekStart: row.weekStart,
      plannedStart: row.startTime,
      plannedEnd: row.endTime,
      shiftDateIso: row.shiftDate,
      hoursStatus: row.hoursStatus,
    })
    const pick = pickInitialAdminWorkedTimes(row.shiftType, row.startTime, row.endTime)
    setEditStartTime(pick.start)
    setEditEndTime(pick.end)
  }

  const closeHourModal = () => {
    setEditingHours(null)
    setCreatingShift(null)
    setEditStartTime('')
    setEditEndTime('')
    setHourModalError(null)
  }

  const saveHourModal = async () => {
    setHourModalError(null)

    if (editingHours) {
      try {
        const response = await fetch(`/api/admin/hours/${editingHours.id}/edit`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startTime: editStartTime,
            endTime: editEndTime,
          }),
        })

        if (response.ok) {
          closeHourModal()
          successClick()
          fetchWorkedHours()
          fetchMissingShifts()
        } else {
          let msg = 'Errore durante la modifica'
          try {
            const error = await response.json()
            if (typeof error?.error === 'string') msg = error.error
          } catch {
            /* ignore */
          }
          setHourModalError(msg)
        }
      } catch (error) {
        console.error('Error editing hours:', error)
        setHourModalError('Errore di connessione durante la modifica')
      }
      return
    }

    if (creatingShift) {
      try {
        const isRejected = creatingShift.workedHoursId && creatingShift.hoursStatus === 'REJECTED'
        const url = isRejected
          ? `/api/admin/hours/${creatingShift.workedHoursId}/edit`
          : '/api/admin/hours'
        const response = await fetch(url, {
          method: isRejected ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isRejected
              ? { startTime: editStartTime, endTime: editEndTime }
              : { shiftId: creatingShift.shiftId, startTime: editStartTime, endTime: editEndTime }
          ),
        })

        if (response.ok) {
          closeHourModal()
          successClick()
          fetchWorkedHours()
          fetchMissingShifts()
        } else {
          let msg = 'Errore salvataggio'
          try {
            const err = await response.json()
            if (typeof err?.error === 'string') msg = err.error
          } catch {
            /* ignore */
          }
          setHourModalError(msg)
        }
      } catch (error) {
        console.error('Error saving hours:', error)
        setHourModalError('Errore di connessione durante il salvataggio')
      }
    }
  }

  const modalShiftType = editingHours?.shift.shiftType ?? creatingShift?.shiftType ?? null

  const hourModalTimeBounds = useMemo(() => {
    if (!modalShiftType) return null
    return {
      start: adminWorkedNativeTimeBounds(modalShiftType, 'start'),
      end: adminWorkedNativeTimeBounds(modalShiftType, 'end'),
    }
  }, [modalShiftType])

  useEffect(() => {
    if (!modalShiftType || !editStartTime) return
    const v = validateAdminWorkedTimes(modalShiftType, editStartTime, editEndTime)
    if (v.ok) return
    const fixed = pickInitialAdminWorkedTimes(modalShiftType, editStartTime, editEndTime)
    if (fixed.end !== editEndTime) setEditEndTime(fixed.end)
    // Solo allinea la fine quando cambia l'inizio (o il tipo turno), non mentre l'utente modifica la fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vedi sopra
  }, [modalShiftType, editStartTime])

  const hourModalPreview =
    modalShiftType && editStartTime && editEndTime
      ? validateAdminWorkedTimes(modalShiftType, editStartTime, editEndTime)
      : null

  const getShiftDate = (shift: Shift): Date =>
    shiftCalendarDateUtc(shift.schedule.weekStart, shift.dayOfWeek)

  const getStatusText = (status: HoursStatus) => {
    switch (status) {
      case 'PENDING':
        return 'In attesa'
      case 'APPROVED':
        return 'Approvate'
      case 'REJECTED':
        return 'Rifiutate'
      default:
        return status
    }
  }

  const formatReviewedAtLabel = (status: HoursStatus, reviewedAtIso?: string) => {
    if (!reviewedAtIso || status === 'PENDING') return null
    const d = new Date(reviewedAtIso)
    if (Number.isNaN(d.getTime())) return null
    const when = format(d, 'd MMM yyyy, HH:mm', { locale: it })
    if (status === 'APPROVED') return `Approvato il ${when}`
    if (status === 'REJECTED') return `Rifiutato il ${when}`
    return null
  }

  const totalHours = workedHours.reduce((sum, h) => sum + h.totalHours, 0)
  const pendingCount = workedHours.filter(h => h.status === 'PENDING').length

  // Raggruppa per utente
  const groupedByUser = workedHours.reduce((acc, hours) => {
    const userId = hours.user.id
    if (!acc[userId]) {
      acc[userId] = {
        user: hours.user,
        hours: [],
        totalHours: 0
      }
    }
    acc[userId].hours.push(hours)
    acc[userId].totalHours += hours.totalHours
    return acc
  }, {} as Record<string, { user: { id: string; username: string; primaryRole: Role }; hours: WorkedHours[]; totalHours: number }>)

  const userGroups = Object.values(groupedByUser).sort((a, b) => 
    a.user.username.localeCompare(b.user.username)
  )

  const normalizedEmployeeSearch = employeeSearch.trim().toLowerCase()
  const visibleUserGroups = normalizedEmployeeSearch
    ? userGroups.filter((group) =>
        group.user.username.toLowerCase().includes(normalizedEmployeeSearch)
      )
    : userGroups

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

  return (
    <MainLayout adminOnly>
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        {/* Header con stile Premium */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-orange-100 transform -rotate-3">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
                  Gestione Ore Lavorate
                </h1>
                <p className="text-gray-500 mt-2 text-sm font-medium">
                  Inserisci le ore per i turni, controlla le richieste in attesa e approva o rifiuta.
                </p>
              </div>
            </div>

            {/* Quick Stats Summary */}
            <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Da revisionare</p>
                <p className="text-3xl font-black text-orange-600 leading-none">{pendingCount}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ore Totali</p>
                <p className="text-3xl font-black text-gray-900 leading-none">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-[2rem] border border-blue-100 p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-blue-600 flex items-center justify-center shadow-sm shrink-0">
              <Edit2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Correggere ore sbagliate</h2>
              <p className="text-sm text-blue-900/70 font-semibold mt-1 leading-relaxed">
                Seleziona mese e stato, cerca il dipendente, apri la sua scheda e premi <span className="font-black">Correggi ore</span>.
                Scegli orari con il selettore (incrementi di 5 minuti). Dopo il salvataggio il totale viene ricalcolato e la modifica resta registrata nello storico.
              </p>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-[2rem] shadow-soft border border-gray-100 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ReactSelect
              label="Stato Approvazione"
              options={[
                { value: 'ALL', label: 'Tutti gli stati' },
                { value: 'PENDING', label: '⏳ In attesa' },
                { value: 'APPROVED', label: '✅ Approvate' },
                { value: 'REJECTED', label: '❌ Rifiutate' }
              ]}
              value={{ value: filterStatus, label: filterStatus === 'ALL' ? 'Tutti gli stati' : filterStatus === 'PENDING' ? '⏳ In attesa' : filterStatus === 'APPROVED' ? '✅ Approvate' : '❌ Rifiutate' }}
              onChange={(option) => {
                lightClick()
                setFilterStatus(option?.value as HoursStatus | 'ALL' || 'ALL')
              }}
            />
            
            <ReactSelect
              label="Mese"
              options={[
                { value: 0, label: 'Tutti i mesi' },
                ...Array.from({ length: 12 }, (_, i) => ({
                  value: i + 1,
                  label: new Date(2024, i).toLocaleDateString('it-IT', { month: 'long' }),
                })),
              ]}
              value={{
                value: selectedMonth,
                label:
                  selectedMonth === 0
                    ? 'Tutti i mesi'
                    : new Date(2024, selectedMonth - 1).toLocaleDateString('it-IT', { month: 'long' }),
              }}
              onChange={(option) => {
                lightClick()
                setSelectedMonth((option?.value as number) ?? 1)
              }}
            />

            <div className={cn(selectedMonth === 0 && 'opacity-40 pointer-events-none')}>
              <ReactSelect
                label="Anno"
                options={yearOptions.map((y) => ({
                  value: y,
                  label: String(y),
                }))}
                value={{ value: selectedYear, label: String(selectedYear) }}
                onChange={(option) => {
                  lightClick()
                  setSelectedYear((option?.value as number) ?? new Date().getFullYear())
                }}
              />
            </div>
          </div>
        </div>

        {/* Turni senza ore (o rifiutate) */}
        <div className="bg-white rounded-[2rem] shadow-soft border border-amber-100 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Turni senza ore registrate</h2>
              <p className="text-sm text-gray-500 mt-1">
                Inserisci start/fine effettivi per i turni passati ancora senza ore, oppure correggi quelle rifiutate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                lightClick()
                fetchMissingShifts()
              }}
              className="shrink-0 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-all"
            >
              Aggiorna elenco
            </button>
          </div>
          {missingLoading ? (
            <CardSkeleton />
          ) : missingByUser.length === 0 ? (
            <p className="text-sm font-medium text-gray-400 text-center py-8">
              Nessun turno passato in attesa di ore per i filtri del sistema.
            </p>
          ) : (
            <div className="space-y-4">
              {missingByUser.map((u) => (
                <div
                  key={u.userId}
                  className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-black text-gray-900">{u.username}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      {getRoleName(u.primaryRole)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {u.shifts.map((row) => (
                      <button
                        key={row.shiftId}
                        type="button"
                        onClick={() => openCreateShiftModal(u, row)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-800 hover:border-orange-300 hover:bg-orange-50/50 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5 text-orange-600" />
                        {formatDate(shiftCalendarDateUtc(row.weekStart, row.dayOfWeek))} ·{' '}
                        {getShiftTypeName(row.shiftType)}
                        {row.hoursStatus === 'REJECTED' ? ' · Rifiutato' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {fetchError && (
          <div className="rounded-[2rem] border border-red-200 bg-red-50 px-6 py-4 text-sm font-bold text-red-800">
            {fetchError}
          </div>
        )}

        {/* Worked Hours List */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] shadow-soft border border-gray-100 p-5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Cerca dipendente
            </label>
            <div className="relative mt-3">
              <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
              <input
                type="search"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Nome dipendente..."
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              <TableSkeleton cols={5} rows={3} />
              <TableSkeleton cols={5} rows={3} />
            </div>
          ) : visibleUserGroups.length > 0 ? (
            visibleUserGroups.map((group) => {
              const isExpanded = expandedUsers.has(group.user.id)
              const groupPendingCount = group.hours.filter(h => h.status === 'PENDING').length
              
              return (
                <div key={group.user.id} className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden group/user transition-all duration-300">
                  {/* User Group Header */}
                  <button
                    onClick={() => {
                      lightClick()
                      toggleUser(group.user.id)
                    }}
                    className={cn(
                      "w-full px-8 py-6 flex items-center justify-between transition-all duration-300 text-left",
                      isExpanded ? "bg-orange-50/50 border-b border-orange-100" : "bg-white hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                        isExpanded ? "bg-orange-600 text-white shadow-lg shadow-orange-100" : "bg-gray-100 text-gray-400 group-hover/user:bg-orange-100 group-hover/user:text-orange-600"
                      )}>
                        <User className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-gray-900 leading-none">{group.user.username}</h3>
                          {groupPendingCount > 0 && (
                            <span className="px-2 py-1 bg-orange-600 text-white text-[10px] font-black uppercase rounded-full animate-pulse">
                              {groupPendingCount} PENDING
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">{getRoleName(group.user.primaryRole)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="hidden sm:flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Turni</p>
                          <p className="text-xl font-black text-gray-900 leading-none">{group.hours.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Totali</p>
                          <p className="text-xl font-black text-orange-600 leading-none">{group.totalHours.toFixed(1)}h</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 transition-all duration-300",
                        isExpanded && "bg-orange-100 text-orange-600 rotate-180"
                      )}>
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content: Shifts Table */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Giorno e Turno</th>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Orario Lavorato</th>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Ore</th>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Stato</th>
                            <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {group.hours.map((hours) => {
                            const shiftDate = getShiftDate(hours.shift)
                            const reviewedLabel = formatReviewedAtLabel(hours.status, hours.reviewedAt)
                            return (
                              <tr key={hours.id} className="hover:bg-gray-50/50 transition-colors group/row">
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex flex-col items-center justify-center font-black text-gray-400 border border-gray-100">
                                      <span className="text-[8px] uppercase leading-none">{getDayName(hours.shift.dayOfWeek).substring(0, 3)}</span>
                                      <span className="text-sm leading-none mt-1">{format(shiftDate, 'd')}</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-gray-900 leading-tight">
                                        {getShiftTypeName(hours.shift.shiftType)}
                                      </p>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                                        {getRoleName(hours.shift.role)}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-900">{hours.startTime}</span>
                                    <span className="text-gray-300 text-xs">→</span>
                                    <span className="text-sm font-bold text-gray-900">{hours.endTime}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-center">
                                  <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-900 text-xs font-black rounded-lg">
                                    {hours.totalHours.toFixed(1)}h
                                  </span>
                                </td>
                                <td className="px-8 py-5 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={cn(
                                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                      hours.status === 'PENDING' ? "bg-yellow-100 text-yellow-700" :
                                      hours.status === 'APPROVED' ? "bg-green-100 text-green-700" :
                                      "bg-red-100 text-red-700"
                                    )}>
                                      {getStatusText(hours.status)}
                                    </span>
                                    {hours.status === 'REJECTED' && hours.rejectionReason && (
                                      <p className="text-[9px] text-red-500 font-bold max-w-[120px] truncate" title={hours.rejectionReason}>
                                        {hours.rejectionReason}
                                      </p>
                                    )}
                                    {reviewedLabel && (
                                      <p
                                        className="text-[9px] text-gray-500 font-bold text-center max-w-[160px] leading-tight"
                                        title={hours.reviewedAt}
                                      >
                                        {reviewedLabel}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(hours)}
                                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl transition-all active:scale-90"
                                      title="Correggi ore"
                                      aria-label={`Correggi ore di ${hours.user.username}`}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                      <span className="hidden xl:inline text-[10px] font-black uppercase tracking-widest">
                                        Correggi ore
                                      </span>
                                    </button>
                                    {hours.status === 'PENDING' && (
                                      <>
                                        <button
                                          onClick={() => approveHours(hours.id)}
                                          className="p-2 bg-gray-100 text-gray-400 hover:bg-green-600 hover:text-white rounded-xl transition-all active:scale-90"
                                          title="Approva"
                                        >
                                          <Check className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            lightClick()
                                            setRejectingId(hours.id)
                                          }}
                                          className="p-2 bg-gray-100 text-gray-400 hover:bg-red-600 hover:text-white rounded-xl transition-all active:scale-90"
                                          title="Rifiuta"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="bg-white rounded-[3rem] border-2 border-dashed border-gray-100 py-20 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="h-10 w-10 text-gray-200" />
              </div>
              <h3 className="text-gray-400 font-black uppercase tracking-[0.2em] text-sm">
                {userGroups.length > 0
                  ? 'Nessun dipendente trovato con questa ricerca'
                  : 'Nessuna ora trovata per questi filtri'}
              </h3>
            </div>
          )}
        </div>
      </div>

      {/* Ore: modifica o inserimento admin */}
      <Modal
        isOpen={!!editingHours || !!creatingShift}
        onClose={closeHourModal}
        title={
          creatingShift
            ? creatingShift.hoursStatus === 'REJECTED'
              ? 'Correggi ore rifiutate'
              : 'Inserisci ore turno'
            : 'Correggi ore'
        }
        subtitle={
          creatingShift
            ? `${creatingShift.username} · ${getDayName(creatingShift.dayOfWeek)} ${getShiftTypeName(creatingShift.shiftType)}`
            : editingHours
              ? `${editingHours.user.username} · ${getDayName(editingHours.shift.dayOfWeek)} ${getShiftTypeName(editingHours.shift.shiftType)}`
              : ''
        }
        headerIcon={<Edit2 className="h-6 w-6" />}
        maxWidth="lg"
      >
        {(editingHours || creatingShift) && (
          <div className="space-y-8 pt-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-[2rem] p-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Orario turno pianificato</p>
                <p className="text-xl font-black text-gray-900">
                  {(editingHours?.shift.startTime ?? creatingShift?.plannedStart) ?? '—'} -{' '}
                  {(editingHours?.shift.endTime ?? creatingShift?.plannedEnd) ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ruolo assegnato</p>
                <p className="text-xl font-black text-gray-900">
                  {getRoleName((editingHours?.shift.role ?? creatingShift?.role)!)}
                </p>
              </div>
            </div>

            {hourModalTimeBounds && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label
                    htmlFor="admin-worked-start"
                    className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1"
                  >
                    Ora inizio effettiva
                  </label>
                  <input
                    id="admin-worked-start"
                    type="time"
                    step={ADMIN_WORKED_TIME_INPUT_STEP_SEC}
                    min={hourModalTimeBounds.start.min}
                    max={hourModalTimeBounds.start.max}
                    value={editStartTime}
                    onChange={(e) => {
                      lightClick()
                      setHourModalError(null)
                      setEditStartTime(e.target.value)
                    }}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-[2rem] px-6 py-4 text-lg font-black text-gray-900 focus:outline-none focus:border-orange-500 transition-all [color-scheme:light]"
                  />
                  <p className="text-[10px] font-bold text-gray-400 ml-1">
                    Fascia {hourModalTimeBounds.start.min}–{hourModalTimeBounds.start.max} (ogni 5 min)
                  </p>
                </div>
                <div className="space-y-3">
                  <label
                    htmlFor="admin-worked-end"
                    className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1"
                  >
                    Ora fine effettiva
                  </label>
                  <input
                    id="admin-worked-end"
                    type="time"
                    step={ADMIN_WORKED_TIME_INPUT_STEP_SEC}
                    min={hourModalTimeBounds.end.min}
                    max={hourModalTimeBounds.end.max}
                    value={editEndTime}
                    disabled={!editStartTime}
                    onChange={(e) => {
                      lightClick()
                      setHourModalError(null)
                      setEditEndTime(e.target.value)
                    }}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-[2rem] px-6 py-4 text-lg font-black text-gray-900 focus:outline-none focus:border-orange-500 transition-all disabled:opacity-40 disabled:pointer-events-none [color-scheme:light]"
                  />
                  <p className="text-[10px] font-bold text-gray-400 ml-1">
                    Fascia {hourModalTimeBounds.end.min}–{hourModalTimeBounds.end.max} (ogni 5 min)
                  </p>
                </div>
              </div>
            )}

            {editStartTime && editEndTime && hourModalPreview && (
              <>
                {hourModalPreview.ok ? (
                  <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-[2rem] p-8 shadow-xl shadow-orange-100 flex items-center justify-between text-white">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                        Ricalcolo ore totali
                      </h4>
                      <p className="text-lg font-bold mt-1">
                        {editStartTime} – {editEndTime}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black">{hourModalPreview.totalHours.toFixed(1)}h</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[2rem] border-2 border-red-100 bg-red-50 px-6 py-4 text-sm font-semibold text-red-800">
                    {hourModalPreview.error}
                  </div>
                )}
              </>
            )}

            {hourModalError && (
              <div className="rounded-[2rem] border-2 border-red-100 bg-red-50 px-6 py-4 text-sm font-semibold text-red-800">
                {hourModalError}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={closeHourModal}
                className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={saveHourModal}
                disabled={!editStartTime || !editEndTime || !hourModalPreview?.ok}
                className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-100 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                {creatingShift && !creatingShift.workedHoursId ? 'Salva ore' : 'Salva modifiche'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectingId}
        onClose={() => {
          setRejectingId(null)
          setRejectReason('')
        }}
        title="Rifiuta Ore"
        headerIcon={<X className="h-6 w-6" />}
      >
        <div className="space-y-6 pt-4">
          <div className="bg-red-50 rounded-[1.5rem] p-5 border border-red-100">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <p className="text-sm font-bold text-red-800 leading-tight">
                Le ore resteranno rifiutate finché un amministratore non le corregge. Indica il motivo del rifiuto.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Motivo del rifiuto</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-[2rem] px-6 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:border-orange-500 transition-all resize-none"
              placeholder="Esempio: L'orario di fine non corrisponde alla chiusura effettiva..."
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={() => {
                setRejectingId(null)
                setRejectReason('')
              }}
              className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95"
            >
              Annulla
            </button>
            <button
              onClick={() => rejectHours(rejectingId!, rejectReason)}
              disabled={!rejectReason.trim()}
              className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-100 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              Rifiuta Ore
            </button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}
