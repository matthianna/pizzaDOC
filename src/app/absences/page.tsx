'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Calendar, Plus, Edit2, Trash2, Info, Clock, CheckCircle, CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Absence {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export default function AbsencesPage() {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchAbsences()
  }, [])

  const fetchAbsences = async () => {
    try {
      const response = await fetch('/api/user/absences')
      if (response.ok) {
        const data = await response.json()
        setAbsences(data)
      }
    } catch (error) {
      console.error('Error fetching absences:', error)
      alert('Errore: impossibile caricare le assenze')
    } finally {
      setLoading(false)
    }
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
        notes: notes || null
      }

      let response
      if (editingAbsence) {
        response = await fetch(`/api/user/absences/${editingAbsence.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      } else {
        response = await fetch('/api/user/absences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      }

      if (response.ok) {
        alert(editingAbsence ? 'Assenza modificata con successo!' : 'Assenza creata con successo!')
        resetForm()
        fetchAbsences()
      } else {
        const data = await response.json()
        alert('Errore: ' + (data.error || 'Operazione fallita'))
      }
    } catch (error) {
      console.error('Error submitting absence:', error)
      alert('Errore: impossibile salvare l\'assenza')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa assenza?')) return

    try {
      const response = await fetch(`/api/user/absences/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        alert('Assenza eliminata con successo!')
        fetchAbsences()
      } else {
        const data = await response.json()
        alert('Errore: ' + (data.error || 'Impossibile eliminare l\'assenza'))
      }
    } catch (error) {
      console.error('Error deleting absence:', error)
      alert('Errore: impossibile eliminare l\'assenza')
    }
  }

  const isInPast = (absence: Absence) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(absence.startDate) < today
  }

  const isActive = (absence: Absence) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(absence.startDate)
    const end = new Date(absence.endDate)
    return start <= today && end >= today
  }

  const pastAbsences = absences.filter(a => isInPast(a) && !isActive(a))
  const activeAbsences = absences.filter(a => isActive(a))
  const futureAbsences = absences.filter(a => new Date(a.startDate) > new Date())

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-orange-600 rounded-2xl shadow-lg shadow-orange-200">
              <Calendar className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Assenze e Vacanze</h1>
              <p className="text-gray-500 font-medium text-sm mt-0.5">Gestisci i tuoi periodi di riposo</p>
            </div>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shadow-lg shadow-orange-200 py-6 px-6 font-black uppercase text-xs tracking-widest transition-all active:scale-95"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuova Assenza
          </Button>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 flex items-start gap-4">
          <div className="p-2 bg-blue-100 rounded-xl flex-shrink-0">
            <Info className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-blue-900 text-sm">Informazioni importanti</p>
            <p className="text-blue-700 text-sm mt-1">
              Le assenze già iniziate o nel passato sono bloccate. Durante i periodi di assenza, il sistema disabiliterà automaticamente la possibilità di inserire disponibilità per quei giorni.
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
          </div>
        ) : absences.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-16 text-center shadow-soft border border-gray-100">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CalendarDays className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Nessuna assenza programmata</h3>
            <p className="text-gray-500 font-medium">Clicca su &quot;Nuova Assenza&quot; per aggiungerne una</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Absences */}
            {activeAbsences.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-black text-green-600 uppercase tracking-widest px-1 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  In Corso
                </h2>
                <div className="space-y-3">
                  {activeAbsences.map(absence => (
                    <AbsenceCard
                      key={absence.id}
                      absence={absence}
                      status="active"
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Future Absences */}
            {futureAbsences.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-black text-blue-600 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Programmate
                </h2>
                <div className="space-y-3">
                  {futureAbsences.map(absence => (
                    <AbsenceCard
                      key={absence.id}
                      absence={absence}
                      status="future"
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past Absences */}
            {pastAbsences.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <CalendarDays className="h-3 w-3" />
                  Storico Assenze
                </h2>
                <div className="space-y-3">
                  {pastAbsences.map(absence => (
                    <AbsenceCard
                      key={absence.id}
                      absence={absence}
                      status="past"
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <Modal
            isOpen={true}
            onClose={resetForm}
            title={editingAbsence ? 'Modifica Assenza' : 'Nuova Assenza'}
            subtitle={editingAbsence ? 'Aggiorna i dettagli' : 'Comunica il tuo periodo di assenza'}
            headerIcon={editingAbsence ? <Edit2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            maxWidth="md"
          >
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                    Data Inizio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                    Data Fine
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || format(new Date(), 'yyyy-MM-dd')}
                    required
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                  Motivo <span className="text-gray-300">(opzionale)</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all appearance-none"
                >
                  <option value="">Seleziona motivo...</option>
                  <option value="Vacanza">🏖️ Vacanza</option>
                  <option value="Malattia">🤒 Malattia</option>
                  <option value="Personale">👤 Personale</option>
                  <option value="Altro">📝 Altro</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                  Note <span className="text-gray-300">(opzionale)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all resize-none placeholder-gray-400"
                  placeholder="Note aggiuntive..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] py-4 bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    editingAbsence ? 'Salva Modifiche' : 'Crea Assenza'
                  )}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </MainLayout>
  )
}

function AbsenceCard({
  absence,
  status,
  onEdit,
  onDelete
}: {
  absence: Absence
  status: 'active' | 'future' | 'past'
  onEdit: (absence: Absence) => void
  onDelete: (id: string) => void
}) {
  const startDate = new Date(absence.startDate)
  const endDate = new Date(absence.endDate)
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const statusConfig = {
    active: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      accentBg: 'bg-green-500',
      text: 'text-green-600',
      badge: 'bg-green-500 text-white'
    },
    future: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      accentBg: 'bg-blue-500',
      text: 'text-blue-600',
      badge: 'bg-blue-500 text-white'
    },
    past: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      accentBg: 'bg-gray-400',
      text: 'text-gray-500',
      badge: 'bg-gray-400 text-white'
    }
  }

  const config = statusConfig[status]

  return (
    <div className={cn(
      "bg-white rounded-2xl border shadow-soft overflow-hidden transition-all",
      config.border,
      status === 'past' && 'opacity-60'
    )}>
      <div className={cn("h-1", config.accentBg)} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={cn("p-3 rounded-xl flex-shrink-0", config.bg)}>
              <Calendar className={cn("h-5 w-5", config.text)} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-black text-gray-900">
                  {format(startDate, 'dd/MM/yyyy', { locale: it })} - {format(endDate, 'dd/MM/yyyy', { locale: it })}
                </h3>
                <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase", config.badge)}>
                  {daysDiff} {daysDiff === 1 ? 'giorno' : 'giorni'}
                </span>
              </div>
              
              {absence.reason && (
                <p className="text-sm text-gray-600">
                  <span className="font-bold">Motivo:</span> {absence.reason}
                </p>
              )}
              
              {absence.notes && (
                <p className="text-sm text-gray-500 italic mt-1">
                  {absence.notes}
                </p>
              )}
            </div>
          </div>

          {status !== 'past' && (
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(absence)}
                className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(absence.id)}
                className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
