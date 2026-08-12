'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState, ListRow } from '@/components/ui/list-row'
import { Clock, Check, X, AlertCircle, Edit2, ChevronDown, User, Plus, Search, RefreshCw } from 'lucide-react'
import { getDayName, getRoleName, getShiftTypeName, formatUsername } from '@/lib/utils'
import { formatDateLong, shiftCalendarDateUtc } from '@/lib/date-utils'
import { Role, ShiftType, HoursStatus } from '@prisma/client'
import { Select as ReactSelect } from '@/components/ui/react-select'
import { TableSkeleton, CardSkeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { useHaptics } from '@/hooks/use-haptics'
import {
  adminWorkedNativeTimeBounds,
  adminWorkedTimeOptions,
  parseAdminWorkedHmLoose,
  pickInitialAdminWorkedTimes,
  validateAdminWorkedTimes,
} from '@/lib/admin-worked-time-rules'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'

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

  const adminWorkedStartSelectOptions = useMemo(() => {
    if (!modalShiftType) return []
    return adminWorkedTimeOptions(modalShiftType, 'start')
  }, [modalShiftType])

  const adminWorkedEndSelectOptions = useMemo(() => {
    if (!modalShiftType) return []
    const after = editStartTime ? parseAdminWorkedHmLoose(editStartTime) : null
    return adminWorkedTimeOptions(modalShiftType, 'end', after)
  }, [modalShiftType, editStartTime])

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

  const missingCount = useMemo(
    () => missingByUser.reduce((n, u) => n + u.shifts.length, 0),
    [missingByUser]
  )

  const missingDateGroups = useMemo(() => {
    type Item = { user: MissingUserGroup; row: MissingShiftRow }
    const buckets = new Map<string, { key: string; date: Date; items: Item[] }>()

    for (const user of missingByUser) {
      for (const row of user.shifts) {
        const date = shiftCalendarDateUtc(row.weekStart, row.dayOfWeek)
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
        const bucket = buckets.get(key) ?? { key, date, items: [] }
        bucket.items.push({ user, row })
        buckets.set(key, bucket)
      }
    }

    return Array.from(buckets.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((group) => ({
        ...group,
        label: formatDateLong(group.date),
        items: group.items.sort((a, b) => {
          const byShift = a.row.shiftType.localeCompare(b.row.shiftType)
          if (byShift !== 0) return byShift
          return a.user.username.localeCompare(b.user.username)
        }),
      }))
  }, [missingByUser])

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
    <MainLayout adminOnly contentWidth="6xl">
      <div className="pd-page pb-16">
        <PageHeader
          dense
          title="Inserimento ore"
          subtitle="Revisiona, correggi e approva le ore dei turni"
        />

        <div
          className="px-4 py-3 text-sm"
          style={{
            background: 'var(--pd-accent-soft)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-lg)',
            color: 'var(--pd-text)',
          }}
        >
          Per correggere ore errate: filtra mese e stato, cerca il dipendente, apri la scheda e usa{' '}
          <span className="font-semibold">Correggi ore</span>. Gli orari usano incrementi di 5 minuti.
        </div>

        <div
          className="p-4"
          style={{
            background: 'var(--pd-surface)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-lg)',
            boxShadow: 'var(--pd-shadow)',
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ReactSelect
              label="Stato Approvazione"
              options={[
                { value: 'ALL', label: 'Tutti gli stati' },
                { value: 'PENDING', label: 'In attesa' },
                { value: 'APPROVED', label: 'Approvate' },
                { value: 'REJECTED', label: 'Rifiutate' }
              ]}
              value={{ value: filterStatus, label: filterStatus === 'ALL' ? 'Tutti gli stati' : filterStatus === 'PENDING' ? 'In attesa' : filterStatus === 'APPROVED' ? 'Approvate' : 'Rifiutate' }}
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
        <SectionBlock
          title={
            missingCount > 0 ? `Turni senza ore · ${missingCount}` : 'Turni senza ore'
          }
          subtitle="Inserisci gli orari effettivi o correggi i turni rifiutati."
          action={
            <button
              type="button"
              onClick={() => {
                lightClick()
                fetchMissingShifts()
              }}
              aria-label="Aggiorna elenco"
              title="Aggiorna elenco"
              className="shrink-0 inline-flex items-center justify-center h-9 w-9 pd-press"
              style={{
                color: 'var(--pd-muted)',
                background: 'var(--pd-surface-muted)',
                borderRadius: 'var(--pd-radius)',
              }}
            >
              <RefreshCw className={cn('h-4 w-4', missingLoading && 'animate-spin')} />
            </button>
          }
          card
        >
          {missingLoading && missingDateGroups.length === 0 ? (
            <div className="p-4">
              <CardSkeleton />
            </div>
          ) : missingDateGroups.length === 0 ? (
            <EmptyState
              title="Nessun turno in attesa"
              description="Tutti i turni passati hanno già le ore inserite."
              icon={<Clock className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
            />
          ) : (
            <div>
              {missingDateGroups.map((group) => (
                <div key={group.key}>
                  <div className="pd-card-header flex items-center justify-between gap-3 px-4 py-2">
                    <p
                      className="text-xs font-semibold capitalize truncate"
                      style={{ color: 'var(--pd-text)' }}
                    >
                      {group.label}
                    </p>
                    <span
                      className="text-[11px] font-medium tabular-nums px-2 py-0.5 shrink-0"
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
                  {group.items.map(({ user, row }) => {
                    const rejected = row.hoursStatus === 'REJECTED'
                    return (
                      <ListRow
                        key={row.shiftId}
                        as="button"
                        onClick={() => openCreateShiftModal(user, row)}
                        title={formatUsername(user.username)}
                        subtitle={`${getRoleName(user.primaryRole)} · ${getShiftTypeName(row.shiftType)}${
                          rejected ? ' · Rifiutato' : ''
                        }`}
                        trailing={
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold"
                            style={{ color: rejected ? 'var(--pd-danger)' : 'var(--pd-accent)' }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {rejected ? 'Correggi' : 'Ore'}
                          </span>
                        }
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </SectionBlock>

        {fetchError && (
          <div
            className="rounded-[var(--pd-radius-lg)] border px-6 py-4 text-sm font-bold"
            style={{
              borderColor: 'var(--pd-border)',
              background: 'var(--pd-danger-soft)',
              color: 'var(--pd-danger)',
            }}
          >
            {fetchError}
          </div>
        )}

        {/* Worked Hours List */}
        <div className="space-y-6">
          <div className="bg-[var(--pd-surface)] rounded-[var(--pd-radius-lg)] shadow-[var(--pd-shadow)] border border-[var(--pd-border)] p-5">
            <label className="text-[10px] font-semibold text-[var(--pd-muted)]  ml-1">
              Cerca dipendente
            </label>
            <div className="relative mt-3">
              <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pd-muted)]/50" />
              <input
                type="search"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Nome dipendente..."
                className="w-full bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-[var(--pd-text)] placeholder:text-[var(--pd-muted)]/50 focus:outline-none focus:border-[var(--pd-accent)] transition-all"
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
                <div key={group.user.id} className="bg-[var(--pd-surface)] rounded-[var(--pd-radius-lg)] shadow-[var(--pd-shadow)] border border-[var(--pd-border)] overflow-hidden group/user transition-all duration-300">
                  {/* User Group Header */}
                  <button
                    onClick={() => {
                      lightClick()
                      toggleUser(group.user.id)
                    }}
                    className={cn(
                      "w-full px-8 py-6 flex items-center justify-between transition-all duration-300 text-left",
                      isExpanded ? "bg-[var(--pd-accent-soft)]/50 border-b border-[var(--pd-border)]" : "bg-[var(--pd-surface)] hover:bg-[var(--pd-surface-muted)]"
                    )}
                  >
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                        isExpanded ? "bg-[var(--pd-accent)] text-[var(--pd-accent-fg)]" : "bg-[var(--pd-surface-muted)] text-[var(--pd-muted)] group-hover/user:bg-[var(--pd-accent-soft)] group-hover/user:text-[var(--pd-accent)]"
                      )}>
                        <User className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-[var(--pd-text)] leading-none">{formatUsername(group.user.username)}</h3>
                          {groupPendingCount > 0 && (
                            <span className="px-2 py-1 bg-[var(--pd-accent)] text-[var(--pd-accent-fg)] text-[10px] font-semibold uppercase rounded-full animate-pulse">
                              {groupPendingCount} PENDING
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-[var(--pd-muted)]  mt-2">{getRoleName(group.user.primaryRole)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="hidden sm:flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-[var(--pd-muted)]  mb-1">Turni</p>
                          <p className="text-xl font-semibold text-[var(--pd-text)] leading-none">{group.hours.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-[var(--pd-muted)]  mb-1">Totali</p>
                          <p className="text-xl font-semibold text-[var(--pd-accent)] leading-none">{formatDecimalHoursIt(group.totalHours)}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-10 h-10 rounded-xl bg-[var(--pd-surface-muted)] flex items-center justify-center text-[var(--pd-muted)] transition-all duration-300",
                        isExpanded && "bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] rotate-180"
                      )}>
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content: Shifts Table */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead style={{ background: 'var(--pd-surface-muted)' }}>
                          <tr>
                            <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--pd-muted)]">Giorno e Turno</th>
                            <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--pd-muted)]">Orario Lavorato</th>
                            <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--pd-muted)] text-center">Ore</th>
                            <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--pd-muted)] text-center">Stato</th>
                            <th className="px-4 py-3 text-right text-[10px] font-semibold text-[var(--pd-muted)]">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--pd-border)]">
                          {group.hours.map((hours) => {
                            const shiftDate = getShiftDate(hours.shift)
                            const reviewedLabel = formatReviewedAtLabel(hours.status, hours.reviewedAt)
                            return (
                              <tr key={hours.id} className="hover:bg-[var(--pd-surface-muted)]/80 transition-colors group/row">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--pd-surface-muted)] flex flex-col items-center justify-center font-semibold text-[var(--pd-muted)] border border-[var(--pd-border)]">
                                      <span className="text-xs uppercase leading-none">{getDayName(hours.shift.dayOfWeek).substring(0, 3)}</span>
                                      <span className="text-sm leading-none mt-1">{format(shiftDate, 'd')}</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-[var(--pd-text)] leading-tight">
                                        {getShiftTypeName(hours.shift.shiftType)}
                                      </p>
                                      <p className="text-[10px] text-[var(--pd-muted)] font-bold mt-1">
                                        {getRoleName(hours.shift.role)}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-[var(--pd-text)]">{hours.startTime}</span>
                                    <span className="text-[var(--pd-muted)]/50 text-xs">→</span>
                                    <span className="text-sm font-bold text-[var(--pd-text)]">{hours.endTime}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center px-3 py-1 bg-[var(--pd-surface-muted)] text-[var(--pd-text)] text-xs font-semibold rounded-lg">
                                    {formatDecimalHoursIt(hours.totalHours)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span
                                      className="px-3 py-1 rounded-full text-[10px] font-semibold"
                                      style={{
                                        background:
                                          hours.status === 'PENDING'
                                            ? 'var(--pd-warning-soft)'
                                            : hours.status === 'APPROVED'
                                              ? 'var(--pd-success-soft)'
                                              : 'var(--pd-danger-soft)',
                                        color:
                                          hours.status === 'PENDING'
                                            ? 'var(--pd-warning)'
                                            : hours.status === 'APPROVED'
                                              ? 'var(--pd-success)'
                                              : 'var(--pd-danger)',
                                      }}
                                    >
                                      {getStatusText(hours.status)}
                                    </span>
                                    {hours.status === 'REJECTED' && hours.rejectionReason && (
                                      <p className="text-[9px] text-[var(--pd-danger)] font-bold max-w-[120px] truncate" title={hours.rejectionReason}>
                                        {hours.rejectionReason}
                                      </p>
                                    )}
                                    {reviewedLabel && (
                                      <p
                                        className="text-[9px] text-[var(--pd-muted)] font-bold text-center max-w-[160px] leading-tight"
                                        title={hours.reviewedAt}
                                      >
                                        {reviewedLabel}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(hours)}
                                      className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] hover:bg-[var(--pd-accent-hover)] hover:text-[var(--pd-accent-fg)] rounded-xl transition-all active:scale-90"
                                      title="Correggi ore"
                                      aria-label={`Correggi ore di ${hours.user.username}`}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                      <span className="hidden xl:inline text-[10px] font-semibold">
                                        Correggi ore
                                      </span>
                                    </button>
                                    {hours.status === 'PENDING' && (
                                      <>
                                        <button
                                          onClick={() => approveHours(hours.id)}
                                          className="p-2 bg-[var(--pd-surface-muted)] text-[var(--pd-muted)] hover:bg-[var(--pd-success)] hover:text-[var(--pd-accent-fg)] rounded-xl transition-all active:scale-90"
                                          title="Approva"
                                        >
                                          <Check className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            lightClick()
                                            setRejectingId(hours.id)
                                          }}
                                          className="p-2 bg-[var(--pd-surface-muted)] text-[var(--pd-muted)] hover:bg-[var(--pd-danger)] hover:text-[var(--pd-accent-fg)] rounded-xl transition-all active:scale-90"
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
            <div className="bg-[var(--pd-surface)] rounded-[var(--pd-radius-lg)] border-2 border-dashed border-[var(--pd-border)] py-20 text-center">
              <div className="w-20 h-20 bg-[var(--pd-surface-muted)] rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="h-10 w-10" style={{ color: 'var(--pd-muted)' }} />
              </div>
              <h3 className="text-[var(--pd-muted)] font-semibold  text-sm">
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
            <div className="grid grid-cols-2 gap-4 bg-[var(--pd-surface-muted)] rounded-[var(--pd-radius-lg)] p-6">
              <div>
                <p className="text-[10px] font-semibold text-[var(--pd-muted)]  mb-1">Orario turno pianificato</p>
                <p className="text-xl font-semibold text-[var(--pd-text)]">
                  {(editingHours?.shift.startTime ?? creatingShift?.plannedStart) ?? '—'} -{' '}
                  {(editingHours?.shift.endTime ?? creatingShift?.plannedEnd) ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[var(--pd-muted)]  mb-1">Ruolo assegnato</p>
                <p className="text-xl font-semibold text-[var(--pd-text)]">
                  {getRoleName((editingHours?.shift.role ?? creatingShift?.role)!)}
                </p>
              </div>
            </div>

            {hourModalTimeBounds && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label
                    htmlFor="admin-worked-start"
                    className="text-xs font-semibold text-[var(--pd-muted)]  ml-1"
                  >
                    Ora inizio effettiva (24h)
                  </label>
                  <div className="relative">
                    <select
                      id="admin-worked-start"
                      value={editStartTime}
                      onChange={(e) => {
                        lightClick()
                        setHourModalError(null)
                        setEditStartTime(e.target.value)
                      }}
                      className="w-full bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-[var(--pd-radius-lg)] pl-6 pr-12 py-4 text-lg font-semibold text-[var(--pd-text)] focus:outline-none focus:border-[var(--pd-accent)] transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Seleziona…</option>
                      {adminWorkedStartSelectOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--pd-muted)] pointer-events-none" aria-hidden />
                  </div>
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] ml-1">
                    Fascia {hourModalTimeBounds.start.min}–{hourModalTimeBounds.start.max} (ogni 5 min, orario italiano)
                  </p>
                </div>
                <div className="space-y-3">
                  <label
                    htmlFor="admin-worked-end"
                    className="text-xs font-semibold text-[var(--pd-muted)]  ml-1"
                  >
                    Ora fine effettiva (24h)
                  </label>
                  <div className="relative">
                    <select
                      id="admin-worked-end"
                      value={editEndTime}
                      disabled={!editStartTime || adminWorkedEndSelectOptions.length === 0}
                      onChange={(e) => {
                        lightClick()
                        setHourModalError(null)
                        setEditEndTime(e.target.value)
                      }}
                      className="w-full bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-[var(--pd-radius-lg)] pl-6 pr-12 py-4 text-lg font-semibold text-[var(--pd-text)] focus:outline-none focus:border-[var(--pd-accent)] transition-all appearance-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <option value="">{editStartTime ? 'Seleziona…' : "Scegli prima l'inizio"}</option>
                      {adminWorkedEndSelectOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--pd-muted)] pointer-events-none" aria-hidden />
                  </div>
                  <p className="text-[10px] font-bold text-[var(--pd-muted)] ml-1">
                    Fascia {hourModalTimeBounds.end.min}–{hourModalTimeBounds.end.max} (ogni 5 min, orario italiano)
                  </p>
                </div>
              </div>
            )}

            {editStartTime && editEndTime && hourModalPreview && (
              <>
                {hourModalPreview.ok ? (
                  <div
                    className="rounded-[var(--pd-radius-lg)] p-8 flex items-center justify-between"
                    style={{ background: 'var(--pd-accent)', color: 'var(--pd-accent-fg)' }}
                  >
                    <div>
                      <h4 className="text-[10px] font-semibold opacity-80">
                        Ricalcolo ore totali
                      </h4>
                      <p className="text-lg font-bold mt-1">
                        {editStartTime} – {editEndTime}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-semibold">{formatDecimalHoursIt(hourModalPreview.totalHours)}</p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-[var(--pd-radius-lg)] border-2 px-6 py-4 text-sm font-semibold"
                    style={{ borderColor: 'var(--pd-border)', background: 'var(--pd-danger-soft)', color: 'var(--pd-danger)' }}
                  >
                    {hourModalPreview.error}
                  </div>
                )}
              </>
            )}

            {hourModalError && (
              <div
                className="rounded-[var(--pd-radius-lg)] border-2 px-6 py-4 text-sm font-semibold"
                style={{ borderColor: 'var(--pd-border)', background: 'var(--pd-danger-soft)', color: 'var(--pd-danger)' }}
              >
                {hourModalError}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={closeHourModal}
                className="flex-1 py-4 bg-[var(--pd-surface-muted)] text-[var(--pd-muted)] rounded-2xl font-semibold text-xs hover:brightness-95 transition-all active:scale-95"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={saveHourModal}
                disabled={!editStartTime || !editEndTime || !hourModalPreview?.ok}
                className="flex-[2] py-4 pd-btn-primary text-xs disabled:opacity-50 flex items-center justify-center gap-2"
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
          <div className="bg-[var(--pd-danger-soft)] rounded-[var(--pd-radius)] p-5 border border-[var(--pd-border)]">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-[var(--pd-danger)] flex-shrink-0" />
              <p className="text-sm font-bold leading-tight" style={{ color: 'var(--pd-danger)' }}>
                Le ore resteranno rifiutate finché un amministratore non le corregge. Indica il motivo del rifiuto.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-semibold text-[var(--pd-muted)]  ml-1">Motivo del rifiuto</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-[var(--pd-radius-lg)] px-6 py-4 text-sm font-bold text-[var(--pd-text)] focus:outline-none focus:border-[var(--pd-accent)] transition-all resize-none"
              placeholder="Esempio: L'orario di fine non corrisponde alla chiusura effettiva..."
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={() => {
                setRejectingId(null)
                setRejectReason('')
              }}
              className="flex-1 py-4 bg-[var(--pd-surface-muted)] text-[var(--pd-muted)] rounded-2xl font-semibold text-xs hover:brightness-95 transition-all active:scale-95"
            >
              Annulla
            </button>
            <button
              onClick={() => rejectHours(rejectingId!, rejectReason)}
              disabled={!rejectReason.trim()}
              className="flex-[2] py-4 rounded-2xl font-semibold text-xs hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--pd-danger)', color: 'var(--pd-accent-fg)' }}
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
