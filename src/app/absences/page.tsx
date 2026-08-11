'use client'

import { useState, useEffect, useMemo } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { ListRow, EmptyState } from '@/components/ui/list-row'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useHaptics } from '@/hooks/use-haptics'
import { Plus, Edit2, Trash2, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Absence {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  notes: string | null
  approved: boolean
  createdAt: string
  updatedAt: string
}

type AbsenceStatus = 'active' | 'future' | 'past'

function countAbsenceDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function isInPast(absence: Absence): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(absence.endDate) < today
}

function isActive(absence: Absence): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(absence.startDate)
  const end = new Date(absence.endDate)
  return start <= today && end >= today
}

function getAbsenceStatus(absence: Absence): AbsenceStatus {
  if (isActive(absence)) return 'active'
  if (isInPast(absence)) return 'past'
  return 'future'
}

export default function AbsencesPage() {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const { showToast, ToastContainer } = useToast()
  const { lightClick } = useHaptics()

  useEffect(() => {
    fetchAbsences()
  }, [])

  const fetchAbsences = async (attempt = 0) => {
    try {
      const response = await fetch('/api/user/absences')
      if (response.ok) {
        const data = await response.json()
        setAbsences(data)
        setLoading(false)
        return
      }
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 400))
        return fetchAbsences(attempt + 1)
      }
      showToast('Impossibile caricare le assenze', 'error')
    } catch (error) {
      console.error('Error fetching absences:', error)
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 400))
        return fetchAbsences(attempt + 1)
      }
      showToast('Impossibile caricare le assenze', 'error')
    }
    setLoading(false)
  }

  const resetForm = () => {
    setStartDate('')
    setEndDate('')
    setReason('')
    setNotes('')
    setEditingAbsence(null)
    setShowForm(false)
  }

  const handleEdit = (absence: Absence) => {
    lightClick()
    setEditingAbsence(absence)
    setStartDate(format(new Date(absence.startDate), 'yyyy-MM-dd'))
    setEndDate(format(new Date(absence.endDate), 'yyyy-MM-dd'))
    setReason(absence.reason || '')
    setNotes(absence.notes || '')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const body = {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason: reason || null,
        notes: notes || null,
      }

      const response = editingAbsence
        ? await fetch(`/api/user/absences/${editingAbsence.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/user/absences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (response.ok) {
        showToast(editingAbsence ? 'Assenza aggiornata' : 'Assenza creata', 'success')
        resetForm()
        fetchAbsences()
      } else {
        const data = await response.json()
        showToast(data.error || 'Operazione fallita', 'error')
      }
    } catch (error) {
      console.error('Error submitting absence:', error)
      showToast('Impossibile salvare l\'assenza', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    try {
      const response = await fetch(`/api/user/absences/${id}`, { method: 'DELETE' })

      if (response.ok) {
        showToast('Assenza eliminata', 'success')
        fetchAbsences()
      } else {
        const data = await response.json()
        showToast(data.error || 'Impossibile eliminare l\'assenza', 'error')
      }
    } catch (error) {
      console.error('Error deleting absence:', error)
      showToast('Impossibile eliminare l\'assenza', 'error')
    } finally {
      setDeleteId(null)
    }
  }

  const { activeAbsences, futureAbsences, pastAbsences } = useMemo(() => {
    const active: Absence[] = []
    const future: Absence[] = []
    const past: Absence[] = []

    for (const absence of absences) {
      const status = getAbsenceStatus(absence)
      if (status === 'active') active.push(absence)
      else if (status === 'future') future.push(absence)
      else past.push(absence)
    }

    const byStart = (a: Absence, b: Absence) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()

    return {
      activeAbsences: active.sort(byStart),
      futureAbsences: future.sort(byStart),
      pastAbsences: past.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    }
  }, [absences])

  const futureDays = futureAbsences.reduce(
    (sum, a) => sum + countAbsenceDays(a.startDate, a.endDate),
    0
  )
  const pastDays = pastAbsences.reduce(
    (sum, a) => sum + countAbsenceDays(a.startDate, a.endDate),
    0
  )
  const programmedDays =
    futureDays + activeAbsences.reduce((s, a) => s + countAbsenceDays(a.startDate, a.endDate), 0)

  return (
    <MainLayout contentWidth="4xl" title="Assenze" subtitle="Vacanze e periodi di riposo">
      <ConfirmDialog
        isOpen={!!deleteId}
        title="Elimina assenza"
        description="Vuoi eliminare questa richiesta di assenza? L’azione non si può annullare."
        confirmLabel="Elimina"
        isDangerous
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />
      <div className="pd-page pb-20">
        <PageHeader
          title="Assenze"
          subtitle="Vacanze e periodi di riposo"
          action={
            <button
              type="button"
              onClick={() => {
                lightClick()
                setShowForm(true)
              }}
              className="px-4 py-2.5 pd-btn-primary text-sm inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuova assenza
            </button>
          }
        />

        {!loading && (
          <StatStrip
            items={[
              { label: 'In corso', value: activeAbsences.length },
              { label: 'Programmate', value: futureAbsences.length },
              { label: 'Giorni', value: programmedDays },
            ]}
          />
        )}

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--pd-muted)' }}>
            Caricamento…
          </div>
        ) : absences.length === 0 ? (
          <SectionBlock card>
            <EmptyState
              title="Nessuna assenza programmata"
              description="Le richieste restano in attesa di approvazione dall'amministrazione prima di essere attive."
              action={
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 pd-btn-primary text-sm"
                >
                  Nuova assenza
                </button>
              }
            />
          </SectionBlock>
        ) : (
          <div className="space-y-6">
            {activeAbsences.length > 0 && (
              <SectionBlock
                title="In corso"
                subtitle={`${activeAbsences.length} ${activeAbsences.length === 1 ? 'assenza attiva' : 'assenze attive'}`}
                card
              >
                {activeAbsences.map(absence => (
                  <AbsenceRow
                    key={absence.id}
                    absence={absence}
                    status="active"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </SectionBlock>
            )}

            {futureAbsences.length > 0 && (
              <SectionBlock
                title="Programmate"
                subtitle={`${futureAbsences.length} · ${futureDays} giorni`}
                card
              >
                {futureAbsences.map(absence => (
                  <AbsenceRow
                    key={absence.id}
                    absence={absence}
                    status="future"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </SectionBlock>
            )}

            {pastAbsences.length > 0 && (
              <div
                className="overflow-hidden"
                style={{
                  background: 'var(--pd-surface)',
                  border: '1px solid var(--pd-border)',
                  borderRadius: 'var(--pd-radius-lg)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    lightClick()
                    setShowHistory(prev => !prev)
                  }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left pd-press"
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                      Storico assenze
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                      {pastAbsences.length} {pastAbsences.length === 1 ? 'periodo' : 'periodi'} ·{' '}
                      {pastDays} giorni
                    </p>
                  </div>
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', showHistory && 'rotate-180')}
                    style={{ color: 'var(--pd-muted)' }}
                  />
                </button>
                {showHistory && (
                  <div style={{ borderTop: '1px solid var(--pd-border)' }}>
                    {pastAbsences.map(absence => (
                      <AbsenceRow
                        key={absence.id}
                        absence={absence}
                        status="past"
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showForm && (
          <Modal
            isOpen
            onClose={resetForm}
            title={editingAbsence ? 'Modifica assenza' : 'Nuova assenza'}
            subtitle={
              editingAbsence
                ? 'Aggiorna i dettagli'
                : "Resta in attesa di approvazione dall'amministrazione"
            }
            headerIcon={editingAbsence ? <Edit2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            maxWidth="md"
          >
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium px-0.5" style={{ color: 'var(--pd-muted)' }}>
                    Data inizio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                    className="w-full px-3 py-3 text-sm font-medium"
                    style={{
                      background: 'var(--pd-surface-muted)',
                      border: '1px solid var(--pd-border)',
                      borderRadius: 'var(--pd-radius)',
                      color: 'var(--pd-text)',
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium px-0.5" style={{ color: 'var(--pd-muted)' }}>
                    Data fine
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    min={startDate || format(new Date(), 'yyyy-MM-dd')}
                    required
                    className="w-full px-3 py-3 text-sm font-medium"
                    style={{
                      background: 'var(--pd-surface-muted)',
                      border: '1px solid var(--pd-border)',
                      borderRadius: 'var(--pd-radius)',
                      color: 'var(--pd-text)',
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium px-0.5" style={{ color: 'var(--pd-muted)' }}>
                  Motivo <span style={{ opacity: 0.6 }}>(opzionale)</span>
                </label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-3 text-sm font-medium appearance-none"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    border: '1px solid var(--pd-border)',
                    borderRadius: 'var(--pd-radius)',
                    color: 'var(--pd-text)',
                  }}
                >
                  <option value="">Seleziona motivo...</option>
                  <option value="Vacanza">Vacanza</option>
                  <option value="Malattia">Malattia</option>
                  <option value="Personale">Personale</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium px-0.5" style={{ color: 'var(--pd-muted)' }}>
                  Note <span style={{ opacity: 0.6 }}>(opzionale)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-3 text-sm font-medium resize-none"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    border: '1px solid var(--pd-border)',
                    borderRadius: 'var(--pd-radius)',
                    color: 'var(--pd-text)',
                  }}
                  placeholder="Note aggiuntive..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 text-sm font-semibold rounded-[var(--pd-radius)]"
                  style={{ color: 'var(--pd-muted)', background: 'var(--pd-surface-muted)' }}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] py-3 pd-btn-primary text-sm disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? (
                    <div
                      className="animate-spin rounded-full h-4 w-4 border-b-2"
                      style={{ borderColor: 'var(--pd-accent-fg)' }}
                    />
                  ) : editingAbsence ? (
                    'Salva modifiche'
                  ) : (
                    'Crea assenza'
                  )}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}

function AbsenceRow({
  absence,
  status,
  onEdit,
  onDelete,
}: {
  absence: Absence
  status: AbsenceStatus
  onEdit: (absence: Absence) => void
  onDelete: (id: string) => void
}) {
  const startDate = new Date(absence.startDate)
  const endDate = new Date(absence.endDate)
  const daysDiff = countAbsenceDays(absence.startDate, absence.endDate)
  const isSingleDay = daysDiff === 1

  const title = isSingleDay
    ? format(startDate, 'dd MMM yyyy', { locale: it })
    : `${format(startDate, 'dd/MM/yyyy', { locale: it })} – ${format(endDate, 'dd/MM/yyyy', { locale: it })}`

  const statusLabel =
    status === 'past' ? 'Conclusa' : status === 'active' ? 'In corso' : 'In programma'

  return (
    <ListRow
      title={title}
      subtitle={
        [
          absence.reason,
          absence.notes,
          absence.approved ? 'Approvata' : 'In attesa di approvazione',
          statusLabel,
        ]
          .filter(Boolean)
          .join(' · ')
      }
      meta={`${daysDiff} ${daysDiff === 1 ? 'giorno' : 'giorni'}`}
      trailing={
        status !== 'past' && !absence.approved ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onEdit(absence)}
              className="p-2 pd-press"
              style={{
                color: 'var(--pd-accent)',
                background: 'var(--pd-accent-soft)',
                borderRadius: 'var(--pd-radius)',
              }}
              aria-label="Modifica assenza"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(absence.id)}
              className="p-2 pd-press"
              style={{
                color: 'var(--pd-danger)',
                background: 'var(--pd-surface-muted)',
                borderRadius: 'var(--pd-radius)',
              }}
              aria-label="Elimina assenza"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : undefined
      }
    />
  )
}
