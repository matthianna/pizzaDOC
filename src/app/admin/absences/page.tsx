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
import { EmptyState, ListRow } from '@/components/ui/list-row'
import { cn } from '@/lib/utils'

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
          className="flex flex-wrap gap-2 p-2"
          style={{
            background: 'var(--pd-surface)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-lg)',
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
              className={cn(
                'px-3 py-2 text-sm font-semibold pd-press',
                filter === f.value ? '' : 'opacity-70'
              )}
              style={{
                background: filter === f.value ? 'var(--pd-accent-soft)' : 'transparent',
                color: filter === f.value ? 'var(--pd-accent)' : 'var(--pd-muted)',
                borderRadius: 'var(--pd-radius)',
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

        <SectionBlock title="Elenco assenze" card>
          {loading ? (
            <div className="py-16 flex justify-center">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2"
                style={{ borderColor: 'var(--pd-accent)' }}
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
            <div>
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
            subtitle={editingAbsence.user.username}
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
            description={`Sei sicuro di voler eliminare l'assenza di ${deletingAbsence.user.username}?`}
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

  const statusLabel = !absence.approved
    ? 'In attesa'
    : isActive
      ? 'In corso'
      : isPast
        ? 'Passata'
        : 'Approvata'

  const subtitleParts = [
    absence.user.primaryRole,
    `${format(startDate, 'dd/MM/yyyy', { locale: it })} – ${format(endDate, 'dd/MM/yyyy', { locale: it })}`,
    `${daysDiff} ${daysDiff === 1 ? 'giorno' : 'giorni'}`,
  ]
  if (absence.reason) subtitleParts.push(absence.reason)

  return (
    <ListRow
      highlight={!absence.approved}
      title={absence.user.username}
      subtitle={subtitleParts.join(' · ')}
      meta={statusLabel}
      trailing={
        <div className="flex items-center gap-1">
          {!absence.approved && (
            <>
              <button
                type="button"
                onClick={onApprove}
                className="p-2 pd-press"
                title="Approva"
                style={{ color: 'var(--pd-success)', borderRadius: 'var(--pd-radius-sm)' }}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onReject}
                className="p-2 pd-press"
                title="Rifiuta"
                style={{ color: 'var(--pd-danger)', borderRadius: 'var(--pd-radius-sm)' }}
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="p-2 pd-press"
            title="Modifica"
            style={{ color: 'var(--pd-muted)', borderRadius: 'var(--pd-radius-sm)' }}
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 pd-press"
            title="Elimina"
            style={{ color: 'var(--pd-danger)', borderRadius: 'var(--pd-radius-sm)' }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      }
    />
  )
}
