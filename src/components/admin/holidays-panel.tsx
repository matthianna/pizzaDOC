'use client'

import { useState, useEffect } from 'react'
import { ListRow, EmptyState } from '@/components/ui/list-row'
import { Plus, Edit, Trash2, Calendar, Check } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Modal } from '@/components/ui/modal'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Holiday {
  id: string
  date: string
  closureType: 'FULL_DAY' | 'PRANZO_ONLY' | 'CENA_ONLY'
  description: string | null
  createdAt: string
  updatedAt: string
}

const getClosureTypeName = (type: string) => {
  switch (type) {
    case 'FULL_DAY':
      return 'Giorno intero'
    case 'PRANZO_ONLY':
      return 'Solo pranzo'
    case 'CENA_ONLY':
      return 'Solo cena'
    default:
      return type
  }
}

/** Inline festivi/chiusure manager for Configurazioni. */
export function HolidaysPanel() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null)
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString())

  useEffect(() => {
    fetchHolidays()
  }, [filterYear])

  const fetchHolidays = async () => {
    setLoading(true)
    try {
      const url = filterYear
        ? `/api/admin/holidays?year=${filterYear}`
        : '/api/admin/holidays'

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setHolidays(data)
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
    } finally {
      setLoading(false)
    }
  }

  const openDeleteConfirm = (holiday: Holiday) => {
    setDeletingHoliday(holiday)
    setShowDeleteConfirm(true)
  }

  const handleDeleteHoliday = async () => {
    if (!deletingHoliday) return

    try {
      const response = await fetch(`/api/admin/holidays/${deletingHoliday.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setHolidays(holidays.filter((h) => h.id !== deletingHoliday.id))
        setShowDeleteConfirm(false)
        setDeletingHoliday(null)
      } else {
        const error = await response.json()
        alert(error.error || "Errore durante l'eliminazione")
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
      alert("Errore durante l'eliminazione")
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i)

  return (
    <>
      <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          className="inline-flex p-1 gap-0.5 overflow-x-auto"
          style={{
            background: 'var(--pd-surface-muted)',
            borderRadius: 'var(--pd-radius)',
            border: '1px solid var(--pd-border)',
          }}
        >
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setFilterYear(year.toString())}
              className={cn(
                'px-3.5 py-2 text-sm font-medium transition-colors',
                filterYear === year.toString() && 'shadow-sm'
              )}
              style={{
                borderRadius: 'calc(var(--pd-radius) - 2px)',
                background: filterYear === year.toString() ? 'var(--pd-surface)' : 'transparent',
                color: filterYear === year.toString() ? 'var(--pd-text)' : 'var(--pd-muted)',
              }}
            >
              {year}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingHoliday(null)
            setShowModal(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm pd-btn-primary"
        >
          <Plus className="h-4 w-4" />
          Nuovo festivo
        </button>
      </div>

      <div style={{ borderTop: '1px solid var(--pd-border)' }}>
        {loading ? (
          <EmptyState title="Caricamento…" />
        ) : holidays.length === 0 ? (
          <EmptyState
            title={`Nessun giorno festivo per il ${filterYear}`}
            description="Aggiungi una chiusura con «Nuovo festivo»."
            icon={<Calendar className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
          />
        ) : (
          holidays.map((holiday) => (
            <ListRow
              key={holiday.id}
              title={format(new Date(holiday.date), 'EEEE d MMMM yyyy', { locale: it })}
              subtitle={
                holiday.description
                  ? `${getClosureTypeName(holiday.closureType)} · ${holiday.description}`
                  : getClosureTypeName(holiday.closureType)
              }
              trailing={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHoliday(holiday)
                      setShowModal(true)
                    }}
                    className="p-2 transition-opacity hover:opacity-80"
                    style={{
                      background: 'var(--pd-surface-muted)',
                      borderRadius: 'var(--pd-radius)',
                      color: 'var(--pd-text)',
                    }}
                    title="Modifica"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteConfirm(holiday)}
                    className="p-2 transition-opacity hover:opacity-80"
                    style={{
                      background: 'var(--pd-danger-soft)',
                      borderRadius: 'var(--pd-radius)',
                      color: 'var(--pd-danger)',
                    }}
                    title="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              }
            />
          ))
        )}
      </div>

      <div
        className="px-4 sm:px-5 py-3 text-xs"
        style={{
          background: 'var(--pd-surface-muted)',
          borderTop: '1px solid var(--pd-border)',
          color: 'var(--pd-muted)',
        }}
      >
        {holidays.length}{' '}
        {holidays.length === 1 ? 'chiusura registrata' : 'chiusure registrate'} per il {filterYear}
      </div>

      {showModal && (
        <HolidayFormModal
          holiday={editingHoliday}
          onClose={() => {
            setShowModal(false)
            setEditingHoliday(null)
          }}
          onSave={() => {
            setShowModal(false)
            setEditingHoliday(null)
            fetchHolidays()
          }}
        />
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeletingHoliday(null)
        }}
        onConfirm={handleDeleteHoliday}
        title="Elimina giorno festivo"
        description="Sei sicuro di voler eliminare questo giorno festivo? Gli utenti potranno nuovamente inserire disponibilità per questo giorno."
        confirmPhrase="ELIMINA"
        confirmButtonText="Elimina"
        isDangerous={true}
        metadata={
          deletingHoliday && (
            <div className="text-sm space-y-1">
              <p>
                <strong>Data:</strong>{' '}
                {format(new Date(deletingHoliday.date), 'd MMMM yyyy', { locale: it })}
              </p>
              <p>
                <strong>Tipo:</strong> {getClosureTypeName(deletingHoliday.closureType)}
              </p>
              {deletingHoliday.description && (
                <p>
                  <strong>Descrizione:</strong> {deletingHoliday.description}
                </p>
              )}
            </div>
          )
        }
      />
    </>
  )
}

function HolidayFormModal({
  holiday,
  onClose,
  onSave,
}: {
  holiday?: Holiday | null
  onClose: () => void
  onSave: () => void
}) {
  const [formData, setFormData] = useState({
    date: holiday ? holiday.date.split('T')[0] : '',
    closureType: holiday?.closureType || ('FULL_DAY' as Holiday['closureType']),
    description: holiday?.description || '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = holiday ? `/api/admin/holidays/${holiday.id}` : '/api/admin/holidays'
      const method = holiday ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        onSave()
      } else {
        const error = await response.json()
        alert(error.error || 'Errore durante il salvataggio')
      }
    } catch (error) {
      console.error('Error saving holiday:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    borderColor: 'var(--pd-border)',
    borderRadius: 'var(--pd-radius)',
    background: 'var(--pd-surface-muted)',
    color: 'var(--pd-text)',
  } as const

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={holiday ? 'Modifica festivo' : 'Nuova festività'}
      subtitle={holiday ? 'Aggiorna i dettagli della chiusura' : 'Imposta una nuova data di chiusura'}
      headerIcon={<Calendar className="h-6 w-6" />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6 pt-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold px-0.5" style={{ color: 'var(--pd-muted)' }}>
            Data chiusura
          </label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2"
            style={inputStyle}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold px-0.5" style={{ color: 'var(--pd-muted)' }}>
            Modalità chiusura
          </label>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'FULL_DAY', label: 'Giorno intero', desc: 'Chiuso sia a pranzo che a cena' },
              { id: 'PRANZO_ONLY', label: 'Solo pranzo', desc: 'Aperto regolarmente a cena' },
              { id: 'CENA_ONLY', label: 'Solo cena', desc: 'Aperto regolarmente a pranzo' },
            ].map((type) => (
              <label
                key={type.id}
                className="flex items-center justify-between p-3.5 border cursor-pointer transition-colors"
                style={{
                  borderRadius: 'var(--pd-radius)',
                  borderColor:
                    formData.closureType === type.id ? 'var(--pd-accent)' : 'var(--pd-border)',
                  background:
                    formData.closureType === type.id ? 'var(--pd-accent-soft)' : 'var(--pd-surface)',
                }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                    {type.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                    {type.desc}
                  </p>
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{
                    borderColor:
                      formData.closureType === type.id ? 'var(--pd-accent)' : 'var(--pd-border)',
                    background:
                      formData.closureType === type.id ? 'var(--pd-accent)' : 'transparent',
                  }}
                >
                  {formData.closureType === type.id && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <input
                  type="radio"
                  name="closureType"
                  className="hidden"
                  checked={formData.closureType === type.id}
                  onChange={() =>
                    setFormData({ ...formData, closureType: type.id as Holiday['closureType'] })
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold px-0.5" style={{ color: 'var(--pd-muted)' }}>
            Motivazione (opzionale)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            placeholder="Es: Vacanze estive, manutenzione…"
            className="w-full border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 resize-none"
            style={inputStyle}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              color: 'var(--pd-muted)',
              borderRadius: 'var(--pd-radius)',
              background: 'var(--pd-surface-muted)',
            }}
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] py-3 text-sm pd-btn-primary disabled:opacity-50"
          >
            {loading ? 'Salvataggio…' : 'Salva festività'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
