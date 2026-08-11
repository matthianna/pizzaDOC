'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, Edit, Trash2, Check, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Modal } from '@/components/ui/modal'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState } from '@/components/ui/list-row'
import { getRoleName, formatUsername } from '@/lib/utils'

interface Absence {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  notes: string | null
  approved: boolean
  approvedBy: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    username: string
    primaryRole: string
  }
}

export default function AdminAbsencesPage() {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'past' | 'active' | 'future'>('all')
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)
  const [deletingAbsence, setDeletingAbsence] = useState<Absence | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [editForm, setEditForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    notes: ''
  })

  useEffect(() => {
    fetchAbsences()
  }, [filter])

  const fetchAbsences = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const response = await fetch(`/api/admin/absences${params}`)
      if (response.ok) {
        const data = await response.json()
        setAbsences(data)
      }
    } catch (error) {
      console.error('Error fetching absences:', error)
    } finally {
      setLoading(false)
    }
  }

  const isActive = (absence: Absence) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(absence.startDate)
    const end = new Date(absence.endDate)
    return start <= today && end >= today
  }

  const isPast = (absence: Absence) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(absence.endDate) < today
  }

  const handleEdit = (absence: Absence) => {
    setEditingAbsence(absence)
    const start = new Date(absence.startDate)
    const end = new Date(absence.endDate)
    setEditForm({
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      reason: absence.reason || '',
      notes: absence.notes || ''
    })
  }

  const approveAbsence = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/absences/${id}/approve`, {
        method: 'POST'
      })

      if (response.ok) {
        fetchAbsences()
      } else {
        console.error('Errore durante l\'approvazione')
      }
    } catch (error) {
      console.error('Error approving absence:', error)
    }
  }

  const rejectAbsence = async (id: string) => {
    if (!rejectionReason.trim()) {
      alert('Inserisci un motivo per il rifiuto')
      return
    }

    try {
      const response = await fetch(`/api/admin/absences/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason })
      })

      if (response.ok) {
        setRejectingId(null)
        setRejectionReason('')
        fetchAbsences()
      } else {
        console.error('Errore durante il rifiuto')
      }
    } catch (error) {
      console.error('Error rejecting absence:', error)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingAbsence) return

    try {
      const response = await fetch(`/api/user/absences/${editingAbsence.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (response.ok) {
        setEditingAbsence(null)
        fetchAbsences()
      } else {
        const error = await response.json()
        console.error(error.error || 'Errore nella modifica')
      }
    } catch (error) {
      console.error('Error updating absence:', error)
    }
  }

  const handleDelete = async () => {
    if (!deletingAbsence) return

    try {
      const response = await fetch(`/api/user/absences/${deletingAbsence.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setDeletingAbsence(null)
        fetchAbsences()
      } else {
        const error = await response.json()
        console.error(error.error || 'Errore nell\'eliminazione')
      }
    } catch (error) {
      console.error('Error deleting absence:', error)
    }
  }

  const pendingCount = absences.filter((a) => !a.approved).length
  const activeCount = absences.filter((a) => isActive(a)).length

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <div className="pd-page pb-16">
        <PageHeader
          dense
          title="Assenze"
          subtitle="Gestisci richieste e periodi di assenza"
        />

        <div
          className="inline-flex p-1 gap-0.5 overflow-x-auto max-w-full"
          style={{
            background: 'var(--pd-surface-muted)',
            borderRadius: 'var(--pd-radius-pill)',
            border: '1px solid var(--pd-border)',
          }}
        >
          {(
            [
              { value: 'all', label: 'Tutte' },
              { value: 'active', label: 'In corso' },
              { value: 'future', label: 'Future' },
              { value: 'past', label: 'Passate' },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className="px-3.5 py-1.5 text-xs font-semibold pd-press whitespace-nowrap"
              style={{
                borderRadius: 'var(--pd-radius-pill)',
                background: filter === f.value ? 'var(--pd-surface)' : 'transparent',
                color: filter === f.value ? 'var(--pd-text)' : 'var(--pd-muted)',
                boxShadow: filter === f.value ? 'var(--pd-shadow)' : undefined,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <StatStrip
          items={[
            { label: 'Totale', value: loading ? '—' : absences.length },
            { label: 'In corso', value: loading ? '—' : activeCount },
            { label: 'In attesa', value: loading ? '—' : pendingCount },
          ]}
        />

        <SectionBlock
          title="Elenco assenze"
          subtitle={
            loading
              ? 'Caricamento…'
              : `${absences.length} ${absences.length === 1 ? 'record' : 'record'} · ${
                  filter === 'all' ? 'tutti i periodi' : filter === 'active' ? 'in corso' : filter === 'future' ? 'future' : 'passate'
                }`
          }
          card
        >
          {loading ? (
            <div className="py-12 flex justify-center">
              <div
                className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                style={{ borderColor: 'var(--pd-accent)', borderTopColor: 'transparent' }}
              />
            </div>
          ) : absences.length === 0 ? (
            <EmptyState
              title="Nessuna assenza trovata"
              description={
                filter !== 'all'
                  ? 'Prova a cambiare i filtri per vedere altre assenze'
                  : 'Non ci sono assenze programmate'
              }
              icon={<Calendar className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
            />
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--pd-border)' }}>
              {absences.map((absence) => (
                <AbsenceRow
                  key={absence.id}
                  absence={absence}
                  isActive={isActive(absence)}
                  isPast={isPast(absence)}
                  onEdit={() => handleEdit(absence)}
                  onDelete={() => setDeletingAbsence(absence)}
                  onApprove={() => approveAbsence(absence.id)}
                  onReject={() => setRejectingId(absence.id)}
                />
              ))}
            </div>
          )}
        </SectionBlock>

        {editingAbsence && (
          <Modal
            isOpen={true}
            onClose={() => setEditingAbsence(null)}
            title="Modifica assenza"
            subtitle={formatUsername(editingAbsence.user.username)}
            maxWidth="md"
          >
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>
                    Data inizio
                  </label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm font-medium border"
                    style={{
                      background: 'var(--pd-surface-muted)',
                      borderColor: 'var(--pd-border)',
                      borderRadius: 'var(--pd-radius)',
                      color: 'var(--pd-text)',
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>
                    Data fine
                  </label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm font-medium border"
                    style={{
                      background: 'var(--pd-surface-muted)',
                      borderColor: 'var(--pd-border)',
                      borderRadius: 'var(--pd-radius)',
                      color: 'var(--pd-text)',
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>
                  Motivazione
                </label>
                <input
                  type="text"
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  placeholder="Es: Vacanze, visita medica..."
                  className="w-full px-3 py-2.5 text-sm font-medium border"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    borderColor: 'var(--pd-border)',
                    borderRadius: 'var(--pd-radius)',
                    color: 'var(--pd-text)',
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>
                  Note interne
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Appunti per l'amministrazione..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm font-medium border resize-none"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    borderColor: 'var(--pd-border)',
                    borderRadius: 'var(--pd-radius)',
                    color: 'var(--pd-text)',
                  }}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAbsence(null)}
                  className="flex-1 py-2.5 text-sm font-semibold pd-press"
                  style={{ color: 'var(--pd-muted)', borderRadius: 'var(--pd-radius)' }}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-[2] py-2.5 text-sm font-semibold pd-btn-primary"
                >
                  Salva modifiche
                </button>
              </div>
            </div>
          </Modal>
        )}

        {deletingAbsence && (
          <ConfirmationModal
            isOpen={true}
            onClose={() => setDeletingAbsence(null)}
            onConfirm={handleDelete}
            title="Elimina assenza"
            description={`Sei sicuro di voler eliminare l'assenza di ${formatUsername(deletingAbsence.user.username)}?`}
            confirmPhrase="ELIMINA"
            confirmButtonText="Conferma eliminazione"
            isDangerous={true}
            metadata={
              <div className="text-sm font-medium" style={{ color: 'var(--pd-danger)' }}>
                Periodo: {format(new Date(deletingAbsence.startDate), 'dd/MM/yyyy')} -{' '}
                {format(new Date(deletingAbsence.endDate), 'dd/MM/yyyy')}
              </div>
            }
          />
        )}

        {rejectingId && (
          <Modal
            isOpen={true}
            onClose={() => {
              setRejectingId(null)
              setRejectionReason('')
            }}
            title="Rifiuta richiesta"
            subtitle="Indica il motivo del rifiuto"
            maxWidth="md"
          >
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>
                  Motivazione rifiuto
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Es: Date non disponibili..."
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm font-medium border resize-none"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    borderColor: 'var(--pd-border)',
                    borderRadius: 'var(--pd-radius)',
                    color: 'var(--pd-text)',
                  }}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(null)
                    setRejectionReason('')
                  }}
                  className="flex-1 py-2.5 text-sm font-semibold pd-press"
                  style={{ color: 'var(--pd-muted)', borderRadius: 'var(--pd-radius)' }}
                >
                  Indietro
                </button>
                <button
                  type="button"
                  onClick={() => rejectAbsence(rejectingId)}
                  disabled={!rejectionReason.trim()}
                  className="flex-[2] py-2.5 text-sm font-semibold disabled:opacity-50"
                  style={{
                    background: 'var(--pd-danger)',
                    color: 'var(--pd-accent-fg)',
                    borderRadius: 'var(--pd-radius)',
                  }}
                >
                  Conferma rifiuto
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </MainLayout>
  )
}


function AbsenceRow({
  absence,
  isActive,
  isPast,
  onEdit,
  onDelete,
  onApprove,
  onReject,
}: {
  absence: Absence
  isActive: boolean
  isPast: boolean
  onEdit: () => void
  onDelete: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const startDate = new Date(absence.startDate)
  const endDate = new Date(absence.endDate)
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const status: { label: string; color: string; bg: string } = !absence.approved
    ? { label: 'In attesa', color: 'var(--pd-warning)', bg: 'var(--pd-warning-soft)' }
    : isActive
      ? { label: 'In corso', color: 'var(--pd-accent)', bg: 'var(--pd-accent-soft)' }
      : isPast
        ? { label: 'Passata', color: 'var(--pd-muted)', bg: 'var(--pd-surface-muted)' }
        : { label: 'Approvata', color: 'var(--pd-success)', bg: 'var(--pd-success-soft)' }

  const roleLabel = getRoleName(absence.user.primaryRole) || '—'

  return (
    <div
      className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
      style={{
        background: !absence.approved
          ? 'color-mix(in srgb, var(--pd-warning-soft) 55%, var(--pd-surface))'
          : 'transparent',
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--pd-text)' }}>
            {formatUsername(absence.user.username)}
          </p>
          <span
            className="inline-flex px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: 'var(--pd-surface-muted)',
              color: 'var(--pd-muted)',
              borderRadius: 'var(--pd-radius-pill)',
            }}
          >
            {roleLabel}
          </span>
          <span
            className="inline-flex px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: status.bg,
              color: status.color,
              borderRadius: 'var(--pd-radius-pill)',
            }}
          >
            {status.label}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--pd-muted)' }}>
          <span className="inline-flex items-center gap-1.5 tabular-nums" style={{ color: 'var(--pd-text)' }}>
            <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--pd-muted)' }} />
            {format(startDate, 'd MMM', { locale: it })}
            {daysDiff > 1 ? ` – ${format(endDate, 'd MMM yyyy', { locale: it })}` : ` ${format(startDate, 'yyyy')}`}
          </span>
          <span className="tabular-nums">
            {daysDiff} {daysDiff === 1 ? 'giorno' : 'giorni'}
          </span>
          {absence.reason ? <span className="truncate max-w-[16rem]">{absence.reason}</span> : null}
        </div>
        {absence.notes ? (
          <p className="mt-1 text-[11px] truncate" style={{ color: 'var(--pd-muted)' }}>
            Note: {absence.notes}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
        {!absence.approved && (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold pd-press"
              style={{
                color: 'var(--pd-success)',
                background: 'var(--pd-success-soft)',
                borderRadius: 'var(--pd-radius)',
              }}
            >
              <Check className="h-3.5 w-3.5" />
              Approva
            </button>
            <button
              type="button"
              onClick={onReject}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold pd-press"
              style={{
                color: 'var(--pd-danger)',
                background: 'var(--pd-danger-soft)',
                borderRadius: 'var(--pd-radius)',
              }}
            >
              <XCircle className="h-3.5 w-3.5" />
              Rifiuta
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="p-2 pd-press"
          title="Modifica"
          style={{
            color: 'var(--pd-muted)',
            background: 'var(--pd-surface-muted)',
            borderRadius: 'var(--pd-radius)',
          }}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 pd-press"
          title="Elimina"
          style={{
            color: 'var(--pd-danger)',
            background: 'var(--pd-danger-soft)',
            borderRadius: 'var(--pd-radius)',
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
