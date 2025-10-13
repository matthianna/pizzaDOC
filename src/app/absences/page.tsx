'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

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
    <MainLayout title="Assenze e Vacanze">
      <div className="space-y-6">
        {/* Header Moderno */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-7 w-7 mr-3 text-orange-600" />
              Assenze e Vacanze
            </h1>
            <p className="text-gray-600 mt-1.5">
              Gestisci i tuoi periodi di assenza
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuova Assenza
          </Button>
        </div>

        {/* Modal Nuova/Modifica Assenza */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 max-w-2xl w-full">
              {/* Header Modal */}
              <div className="bg-gradient-to-br from-orange-50 via-white to-orange-50/30 px-6 py-5 rounded-t-2xl border-b border-orange-100/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                      {editingAbsence ? (
                        <Edit2 className="h-6 w-6 text-white" />
                      ) : (
                        <Plus className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {editingAbsence ? 'Modifica Assenza' : 'Nuova Assenza'}
                      </h2>
                      <p className="text-sm text-orange-600 font-medium mt-0.5">
                        {editingAbsence ? 'Aggiorna i dettagli della tua assenza' : 'Comunica il tuo periodo di assenza'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetForm}
                    className="w-9 h-9 rounded-xl bg-orange-100 hover:bg-orange-200 flex items-center justify-center transition-all hover:scale-105"
                  >
                    <X className="h-5 w-5 text-orange-700" />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">
                      Data Inizio *
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      required
                      className="rounded-xl border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">
                      Data Fine *
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || format(new Date(), 'yyyy-MM-dd')}
                      required
                      className="rounded-xl border-2"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">
                    Motivo <span className="text-xs font-normal text-gray-500">(opzionale)</span>
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  >
                    <option value="">Seleziona motivo (opzionale)</option>
                    <option value="Vacanza">🏖️ Vacanza</option>
                    <option value="Malattia">🤒 Malattia</option>
                    <option value="Personale">👤 Personale</option>
                    <option value="Altro">📝 Altro</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">
                    Note <span className="text-xs font-normal text-gray-500">(opzionale)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    placeholder="Note aggiuntive (opzionale)"
                  />
                </div>

                {/* Footer Modal */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    onClick={resetForm}
                    variant="outline"
                    className="flex-1 rounded-xl border-2"
                  >
                    Annulla
                  </Button>
                  <Button
                    type="submit"
                    isLoading={submitting}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    {editingAbsence ? 'Salva Modifiche' : 'Crea Assenza'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-50 to-cyan-50/50 border border-blue-200/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-bold mb-1">Importante</p>
              <p>Le assenze già iniziate o nel passato non possono essere modificate o eliminate. Durante i periodi di assenza, non potrai inserire disponibilità per i giorni in cui sei assente.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-orange-600"></div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {activeAbsences.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">🟢 Assenze Attive</h2>
                <div className="grid grid-cols-1 gap-4">
                  {activeAbsences.map(absence => (
                    <AbsenceCard 
                      key={absence.id} 
                      absence={absence} 
                      isPast={false}
                      isActive={true}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {futureAbsences.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">📅 Assenze Future</h2>
                <div className="grid grid-cols-1 gap-4">
                  {futureAbsences.map(absence => (
                    <AbsenceCard 
                      key={absence.id} 
                      absence={absence} 
                      isPast={false}
                      isActive={false}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {pastAbsences.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">📋 Storico Assenze</h2>
                <div className="grid grid-cols-1 gap-4">
                  {pastAbsences.map(absence => (
                    <AbsenceCard 
                      key={absence.id} 
                      absence={absence} 
                      isPast={true}
                      isActive={false}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {absences.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Nessuna assenza programmata</p>
                <p className="text-sm text-gray-500 mt-1">
                  Clicca su &quot;Nuova Assenza&quot; per aggiungerne una
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  )
}

function AbsenceCard({
  absence,
  isPast,
  isActive,
  onEdit,
  onDelete
}: {
  absence: Absence
  isPast: boolean
  isActive: boolean
  onEdit: (absence: Absence) => void
  onDelete: (id: string) => void
}) {
  const startDate = new Date(absence.startDate)
  const endDate = new Date(absence.endDate)
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  return (
    <div className={`rounded-lg border-2 p-4 ${
      isActive 
        ? 'bg-green-50 border-green-300'
        : isPast 
          ? 'bg-gray-50 border-gray-300 opacity-75' 
          : 'bg-blue-50 border-blue-300'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className={`h-5 w-5 ${
              isActive ? 'text-green-600' : isPast ? 'text-gray-500' : 'text-blue-600'
            }`} />
            <h3 className="font-semibold text-gray-900">
              {format(startDate, 'dd/MM/yyyy', { locale: it })} - {format(endDate, 'dd/MM/yyyy', { locale: it })}
            </h3>
            <span className="text-sm text-gray-600">
              ({daysDiff} {daysDiff === 1 ? 'giorno' : 'giorni'})
            </span>
          </div>
          
          {absence.reason && (
            <p className="text-sm text-gray-700 mb-1">
              <strong>Motivo:</strong> {absence.reason}
            </p>
          )}
          
          {absence.notes && (
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> {absence.notes}
            </p>
          )}
        </div>

        {!isPast && (
          <div className="flex gap-2 ml-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(absence)}
              className="text-blue-600 hover:text-blue-700"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(absence.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

