'use client'

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Bike, Plus, Edit, Trash2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { getShiftTypeName } from '@/lib/utils'
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
          title={editing ? 'Modifica utilizzo' : 'Registra utilizzo scooter'}
        >
          <div className="space-y-4">
            {prefillShift && (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
                {formatShiftLabel({ ...prefillShift, username: prefillShift.username })}
              </p>
            )}
            {!editing && !prefillShift && (
              <>
                <label className="block text-xs font-bold text-gray-500 uppercase">ID Turno</label>
                <input
                  className="w-full border rounded-xl px-3 py-2"
                  value={formShiftId}
                  onChange={(e) => setFormShiftId(e.target.value)}
                  placeholder="shiftId"
                />
              </>
            )}
            <label className="block text-xs font-bold text-gray-500 uppercase">Utente</label>
            <Select
              value={formUserId}
              onChange={(v) => setFormUserId(String(v))}
              disabled={!!prefillShift}
              placeholder="Seleziona utente"
              options={users.map((u) => ({ value: u.id, label: u.username }))}
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formUsedAuto}
                onChange={(e) => setFormUsedAuto(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-bold text-gray-700">Ha lavorato in auto</span>
            </label>
            {!formUsedAuto && (
              <>
                <label className="block text-xs font-bold text-gray-500 uppercase">Scooter</label>
                <Select
                  value={formScooter}
                  onChange={(v) => setFormScooter(String(v))}
                  options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `Scooter ${n}` }))}
                />
              </>
            )}
            <Button onClick={handleSave} disabled={saving || !formUserId || (!editing && !formShiftId)}>
              {saving ? 'Salvataggio...' : 'Salva'}
            </Button>
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
