'use client'

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import {
  Bike,
  Car,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
} from 'lucide-react'
import { cn, getShiftTypeName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import {
  getWeekStart,
  addWeekCalendarDays,
  formatDate,
  formatMonthYearIt,
} from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useToast } from '@/components/ui/toast'

interface UsageRecord {
  id: string
  shiftId: string
  userId: string
  username: string
  scooterNumber: number | null
  usedAuto: boolean
  recordedAt: string
  weekStart: string
  shiftDate: string
  dayOfWeek: number
  shiftType: string
  startTime: string
  endTime: string
}

interface MissingRow {
  shiftId: string
  userId: string
  username: string
  weekStart: string
  shiftDate: string
  dayOfWeek: number
  shiftType: string
  startTime: string
  endTime: string
}

interface AdminUser {
  id: string
  username: string
}

type Tab = 'storico' | 'mancanti'

export default function AdminScooterUsagePage() {
  const [tab, setTab] = useState<Tab>('storico')
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()))
  const [records, setRecords] = useState<UsageRecord[]>([])
  const [missing, setMissing] = useState<MissingRow[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUserId, setFilterUserId] = useState('')
  const [filterScooter, setFilterScooter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<UsageRecord | null>(null)
  const [prefillShift, setPrefillShift] = useState<MissingRow | null>(null)
  const [formShiftId, setFormShiftId] = useState('')
  const [formUserId, setFormUserId] = useState('')
  const [formScooter, setFormScooter] = useState('1')
  const [formUsedAuto, setFormUsedAuto] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState<UsageRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [maxScooters, setMaxScooters] = useState(4)
  const { showToast, ToastContainer } = useToast()

  const weekEnd = addWeekCalendarDays(currentWeek, 6)

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(
        (Array.isArray(data) ? data : data.users || [])
          .filter((u: { isActive?: boolean }) => u.isActive !== false)
          .map((u: { id: string; username: string }) => ({ id: u.id, username: u.username }))
      )
    }
  }

  const fetchRecords = useCallback(async () => {
    const params = new URLSearchParams({
      weekStart: currentWeek.toISOString(),
    })
    if (filterUserId) params.set('userId', filterUserId)
    if (filterScooter) params.set('scooterNumber', filterScooter)
    const res = await fetch(`/api/admin/scooter-usage?${params}`)
    if (res.ok) setRecords(await res.json())
  }, [currentWeek, filterUserId, filterScooter])

  const fetchMissing = useCallback(async () => {
    const params = new URLSearchParams({ weekStart: currentWeek.toISOString() })
    const res = await fetch(`/api/admin/scooter-usage/missing?${params}`)
    if (res.ok) {
      const data = await res.json()
      setMissing(data.missing ?? [])
    }
  }, [currentWeek])

  useEffect(() => {
    fetchUsers()
    fetch('/api/admin/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const n = parseInt(data?.scooter_count ?? '4', 10)
        if (Number.isFinite(n) && n > 0) setMaxScooters(n)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchRecords(), fetchMissing()]).finally(() => setLoading(false))
  }, [fetchRecords, fetchMissing])

  const openCreate = (prefill?: MissingRow) => {
    setEditing(null)
    setPrefillShift(prefill ?? null)
    setFormShiftId(prefill?.shiftId ?? '')
    setFormUserId(prefill?.userId ?? '')
    setFormScooter('1')
    setFormUsedAuto(false)
    setShowModal(true)
  }

  const openEdit = (record: UsageRecord) => {
    setEditing(record)
    setPrefillShift(null)
    setFormShiftId(record.shiftId)
    setFormUserId(record.userId)
    setFormUsedAuto(record.usedAuto)
    setFormScooter(record.usedAuto ? '1' : String(record.scooterNumber ?? 1))
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch(`/api/admin/scooter-usage/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scooterNumber: formUsedAuto ? null : parseInt(formScooter, 10),
            usedAuto: formUsedAuto,
            userId: formUserId,
          }),
        })
        if (!res.ok) {
          const d = await res.json()
          showToast(d.error || 'Errore', 'error')
          return
        }
        showToast('Record aggiornato', 'success')
      } else {
        const res = await fetch('/api/admin/scooter-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shiftId: formShiftId,
            userId: formUserId,
            scooterNumber: formUsedAuto ? null : parseInt(formScooter, 10),
            usedAuto: formUsedAuto,
          }),
        })
        const d = await res.json()
        if (!res.ok) {
          showToast(d.error || 'Errore', 'error')
          return
        }
        if (d.warning) showToast(d.warning, 'warning')
        showToast('Record creato', 'success')
      }
      setShowModal(false)
      await Promise.all([fetchRecords(), fetchMissing()])
    } catch {
      showToast('Errore nel salvataggio', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    const res = await fetch(`/api/admin/scooter-usage/${deleting.id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Record eliminato', 'success')
      setShowDelete(false)
      setDeleting(null)
      await Promise.all([fetchRecords(), fetchMissing()])
    } else {
      showToast('Errore nell\'eliminazione', 'error')
    }
  }

  const formatShiftLabel = (row: { shiftDate: string; shiftType: string; username?: string }) => {
    const d = format(parseISO(row.shiftDate), 'dd/MM/yyyy (EEEE)', { locale: it })
    return `${row.username ? row.username + ' · ' : ''}${d} · ${getShiftTypeName(row.shiftType as 'PRANZO' | 'CENA')}`
  }

  return (
    <MainLayout adminOnly>
      <ToastContainer />
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center">
              <Bike className="h-6 w-6 text-sky-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Utilizzo Scooter</h1>
              <p className="text-sm text-gray-500 font-medium">Storico e registrazioni mancanti</p>
            </div>
          </div>
          {tab === 'storico' && (
            <Button onClick={() => openCreate()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuovo record
            </Button>
          )}
        </div>

        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setTab('storico')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'storico' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            Storico
          </button>
          <button
            onClick={() => setTab('mancanti')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
              tab === 'mancanti' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            Mancanti
            {missing.length > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                {missing.length}
              </span>
            )}
          </button>
        </div>

        <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-4">
          <button onClick={() => setCurrentWeek((p) => addWeekCalendarDays(p, -7))} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-gray-900">
            {formatDate(currentWeek)} – {formatDate(weekEnd)} ({formatMonthYearIt(currentWeek)})
          </span>
          <button onClick={() => setCurrentWeek((p) => addWeekCalendarDays(p, 7))} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrentWeek(getWeekStart(new Date()))}
            className="text-sm text-sky-600 font-bold"
          >
            Questa settimana
          </button>
          {tab === 'storico' && (
            <>
              <Select
                value={filterUserId}
                onChange={(v) => setFilterUserId(String(v))}
                className="max-w-[200px]"
                placeholder="Tutti gli utenti"
                options={[
                  { value: '', label: 'Tutti gli utenti' },
                  ...users.map((u) => ({ value: u.id, label: u.username })),
                ]}
              />
              <Select
                value={filterScooter}
                onChange={(v) => setFilterScooter(String(v))}
                className="max-w-[140px]"
                placeholder="Tutti"
                options={[
                  { value: '', label: 'Tutti gli scooter' },
                  ...[1, 2, 3, 4].map((n) => ({ value: String(n), label: `Scooter ${n}` })),
                ]}
              />
            </>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-b-2 border-sky-500 rounded-full" />
          </div>
        ) : tab === 'storico' ? (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-bold">Utente</th>
                  <th className="text-left p-3 font-bold">Data turno</th>
                  <th className="text-left p-3 font-bold">Turno</th>
                  <th className="text-left p-3 font-bold">Scooter</th>
                  <th className="text-left p-3 font-bold">Registrato</th>
                  <th className="text-right p-3 font-bold">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Nessun record per questa settimana
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-3 font-medium">{r.username}</td>
                      <td className="p-3">
                        {format(parseISO(r.shiftDate), 'dd/MM/yyyy', { locale: it })}
                      </td>
                      <td className="p-3">{getShiftTypeName(r.shiftType as 'PRANZO' | 'CENA')}</td>
                      <td className="p-3 font-black">{r.usedAuto ? 'Auto' : r.scooterNumber}</td>
                      <td className="p-3 text-gray-500">
                        {format(parseISO(r.recordedAt), 'dd/MM/yyyy HH:mm', { locale: it })}
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => openEdit(r)} className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg inline-flex">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleting(r)
                            setShowDelete(true)
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg inline-flex ml-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-amber-200 bg-amber-50/30">
            <table className="w-full text-sm">
              <thead className="bg-amber-100/50 border-b border-amber-200">
                <tr>
                  <th className="text-left p-3 font-bold">Utente</th>
                  <th className="text-left p-3 font-bold">Data turno</th>
                  <th className="text-left p-3 font-bold">Turno</th>
                  <th className="text-left p-3 font-bold">Orario</th>
                  <th className="text-right p-3 font-bold">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {missing.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-600">
                      Nessuna registrazione mancante per i filtri selezionati
                    </td>
                  </tr>
                ) : (
                  missing.map((m) => (
                    <tr key={m.shiftId} className="border-b border-amber-100">
                      <td className="p-3 font-black text-gray-900">{m.username}</td>
                      <td className="p-3">
                        {format(parseISO(m.shiftDate), 'dd/MM/yyyy (EEEE)', { locale: it })}
                      </td>
                      <td className="p-3 font-bold">{getShiftTypeName(m.shiftType as 'PRANZO' | 'CENA')}</td>
                      <td className="p-3">
                        {m.startTime} – {m.endTime}
                      </td>
                      <td className="p-3 text-right">
                        <Button onClick={() => openCreate(m)} className="text-xs py-2 px-3">
                          Registra per utente
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {missing.length > 0 && (
              <p className="p-4 text-xs text-amber-800 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Ogni riga indica un fattorino che non ha ancora registrato lo scooter per quel turno.
              </p>
            )}
          </div>
        )}

        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
            setPrefillShift(null)
          }}
          title={editing ? 'Modifica utilizzo' : 'Registra utilizzo'}
          subtitle={
            prefillShift
              ? 'Turno senza registrazione'
              : editing
                ? 'Aggiorna scooter o auto'
                : 'Inserimento manuale'
          }
          maxWidth="sm"
          headerIcon={<Bike className="h-7 w-7" strokeWidth={2.5} />}
        >
          <div className="space-y-5 -mt-2">
            {(prefillShift || editing) && (
              <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 space-y-3">
                {prefillShift && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-gray-200 shadow-sm">
                        <User className="h-4 w-4 text-gray-600" />
                      </span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          Fattorino
                        </p>
                        <p className="font-black text-gray-900">{prefillShift.username}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-800 capitalize leading-snug">
                      {format(parseISO(prefillShift.shiftDate), 'EEEE d MMMM yyyy', { locale: it })}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-200">
                        {getShiftTypeName(prefillShift.shiftType as 'PRANZO' | 'CENA')}
                      </span>
                      <span className="text-xs text-gray-600 font-bold flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {prefillShift.startTime} – {prefillShift.endTime}
                      </span>
                    </div>
                  </>
                )}
                {editing && !prefillShift && (
                  <p className="text-sm font-medium text-gray-600">
                    Modifica la registrazione per{' '}
                    <span className="font-black text-gray-900">{editing.username}</span>
                  </p>
                )}
              </div>
            )}

            {!editing && !prefillShift && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                  ID turno
                </label>
                <input
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  value={formShiftId}
                  onChange={(e) => setFormShiftId(e.target.value)}
                  placeholder="Incolla l&apos;ID del turno"
                />
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 pt-2">
                  Utente
                </label>
                <Select
                  value={formUserId}
                  onChange={(v) => setFormUserId(String(v))}
                  placeholder="Seleziona utente"
                  options={users.map((u) => ({ value: u.id, label: u.username }))}
                />
              </div>
            )}

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">
                Mezzo utilizzato
              </p>

              <button
                type="button"
                disabled={saving}
                onClick={() => setFormUsedAuto(true)}
                className={cn(
                  'w-full py-4 rounded-2xl font-black border-2 flex items-center justify-center gap-3 transition-all active:scale-[0.98]',
                  formUsedAuto
                    ? 'bg-gray-900 text-white border-gray-900 shadow-lg'
                    : 'bg-white text-gray-900 border-gray-200 hover:border-gray-400'
                )}
              >
                <Car className="h-6 w-6" />
                Ha lavorato in auto
              </button>

              <div className="relative py-1">
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
                    disabled={saving}
                    onClick={() => {
                      setFormUsedAuto(false)
                      setFormScooter(String(n))
                    }}
                    className={cn(
                      'aspect-square rounded-2xl text-2xl font-black border-2 transition-all active:scale-95 flex flex-col items-center justify-center gap-1',
                      !formUsedAuto && formScooter === String(n)
                        ? 'bg-sky-600 text-white border-sky-700 shadow-lg shadow-sky-200/80'
                        : 'bg-white text-gray-900 border-gray-200 hover:border-sky-400 hover:bg-sky-50'
                    )}
                  >
                    <Bike className="h-5 w-5 opacity-80" />
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl py-3 font-bold"
                disabled={saving}
                onClick={() => {
                  setShowModal(false)
                  setEditing(null)
                  setPrefillShift(null)
                }}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1 rounded-xl py-3 font-black"
                disabled={saving || !formUserId || (!editing && !formShiftId)}
                isLoading={saving}
                onClick={handleSave}
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </Button>
            </div>
          </div>
        </Modal>

        <ConfirmationModal
          isOpen={showDelete}
          onClose={() => {
            setShowDelete(false)
            setDeleting(null)
          }}
          onConfirm={handleDelete}
          title="Elimina record"
          description={`Eliminare la registrazione scooter di ${deleting?.username}?`}
          confirmPhrase="ELIMINA"
          confirmButtonText="Elimina"
          isDangerous
        />
      </div>
    </MainLayout>
  )
}
