'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import { Calendar, Plus, Edit2, Trash2, AlertTriangle, MapPin, Heart, Clock, User } from 'lucide-react'
import { format, parseISO, isBefore, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

interface Absence {
  id: string
  startDate: string
  endDate: string
  type: 'VACATION' | 'SICK_LEAVE' | 'PERSONAL' | 'OTHER'
  reason?: string
  description?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

export default function AbsencesPage() {
  const { data: session } = useSession()
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    type: 'VACATION' as const,
    reason: '',
    description: ''
  })

  useEffect(() => {
    if (session) {
      fetchAbsences()
    }
  }, [session])

  const fetchAbsences = async () => {
    try {
      const response = await fetch('/api/user/absences')
      if (response.ok) {
        const data = await response.json()
        setAbsences(data)
      }
    } catch (error) {
      console.error('Error fetching absences:', error)
      showToast('Errore nel caricamento delle assenze', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingAbsence 
        ? `/api/user/absences/${editingAbsence.id}`
        : '/api/user/absences'
      
      const method = editingAbsence ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        showToast(
          editingAbsence ? 'Assenza aggiornata' : 'Assenza creata',
          'success'
        )
        setShowModal(false)
        setEditingAbsence(null)
        resetForm()
        fetchAbsences()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving absence:', error)
      showToast('Errore durante il salvataggio', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (absence: Absence) => {
    setEditingAbsence(absence)
    setFormData({
      startDate: format(parseISO(absence.startDate), 'yyyy-MM-dd'),
      endDate: format(parseISO(absence.endDate), 'yyyy-MM-dd'),
      type: absence.type,
      reason: absence.reason || '',
      description: absence.description || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (absenceId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa assenza?')) return

    try {
      const response = await fetch(`/api/user/absences/${absenceId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showToast('Assenza eliminata', 'success')
        fetchAbsences()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore durante l\'eliminazione', 'error')
      }
    } catch (error) {
      console.error('Error deleting absence:', error)
      showToast('Errore durante l\'eliminazione', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      startDate: '',
      endDate: '',
      type: 'VACATION',
      reason: '',
      description: ''
    })
  }

  const openNewModal = () => {
    setEditingAbsence(null)
    resetForm()
    setShowModal(true)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'VACATION': return <MapPin className="h-4 w-4" />
      case 'SICK_LEAVE': return <Heart className="h-4 w-4" />
      case 'PERSONAL': return <User className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'VACATION': return 'Vacanze'
      case 'SICK_LEAVE': return 'Malattia'
      case 'PERSONAL': return 'Permesso Personale'
      case 'OTHER': return 'Altro'
      default: return type
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusName = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approvata'
      case 'PENDING': return 'In Attesa'
      case 'REJECTED': return 'Rifiutata'
      default: return status
    }
  }

  const isEditable = (absence: Absence) => {
    const today = startOfDay(new Date())
    const startDate = startOfDay(parseISO(absence.startDate))
    return !isBefore(startDate, today)
  }

  const upcomingAbsences = absences.filter(absence => 
    !isBefore(parseISO(absence.startDate), startOfDay(new Date()))
  )
  const pastAbsences = absences.filter(absence => 
    isBefore(parseISO(absence.startDate), startOfDay(new Date()))
  )

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-orange-500 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Le Mie Assenze
                </h1>
                <p className="text-gray-600">
                  Gestisci le tue vacanze e permessi
                </p>
              </div>
            </div>
            <Button
              onClick={openNewModal}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuova Assenza
            </Button>
          </div>
        </div>

        {/* Upcoming Absences */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Assenze Future e Attuali
            </h2>
            <p className="text-sm text-gray-600">
              Assenze che puoi ancora modificare o eliminare
            </p>
          </div>

          {upcomingAbsences.length === 0 ? (
            <div className="p-6 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nessuna assenza programmata</p>
              <p className="text-sm text-gray-500 mt-1">
                Clicca "Nuova Assenza" per aggiungerne una
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {upcomingAbsences.map((absence) => (
                <div key={absence.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {getTypeIcon(absence.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {getTypeName(absence.type)}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(absence.status)}`}>
                            {getStatusName(absence.status)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 space-y-1">
                          <p>
                            <strong>Dal:</strong> {format(parseISO(absence.startDate), 'dd/MM/yyyy', { locale: it })}
                          </p>
                          <p>
                            <strong>Al:</strong> {format(parseISO(absence.endDate), 'dd/MM/yyyy', { locale: it })}
                          </p>
                          {absence.reason && (
                            <p><strong>Motivo:</strong> {absence.reason}</p>
                          )}
                          {absence.description && (
                            <p><strong>Descrizione:</strong> {absence.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isEditable(absence) && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(absence)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifica"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(absence.id)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Absences */}
        {pastAbsences.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Storico Assenze
              </h2>
              <p className="text-sm text-gray-600">
                Assenze passate (non modificabili)
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {pastAbsences.map((absence) => (
                <div key={absence.id} className="p-6 opacity-75">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      {getTypeIcon(absence.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {getTypeName(absence.type)}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(absence.status)}`}>
                          {getStatusName(absence.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <strong>Dal:</strong> {format(parseISO(absence.startDate), 'dd/MM/yyyy', { locale: it })}
                        </p>
                        <p>
                          <strong>Al:</strong> {format(parseISO(absence.endDate), 'dd/MM/yyyy', { locale: it })}
                        </p>
                        {absence.reason && (
                          <p><strong>Motivo:</strong> {absence.reason}</p>
                        )}
                        {absence.description && (
                          <p><strong>Descrizione:</strong> {absence.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal */}
        {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingAbsence ? 'Modifica Assenza' : 'Nuova Assenza'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo Assenza
                  </label>
                  <Select
                    value={formData.type}
                    onChange={(value) => setFormData({ ...formData, type: value as any })}
                    options={[
                      { value: 'VACATION', label: 'Vacanze' },
                      { value: 'SICK_LEAVE', label: 'Malattia' },
                      { value: 'PERSONAL', label: 'Permesso Personale' },
                      { value: 'OTHER', label: 'Altro' }
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Inizio
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Fine
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      min={formData.startDate || format(new Date(), 'yyyy-MM-dd')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo (opzionale)
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Es. Viaggio, cure mediche..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrizione (opzionale)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Dettagli aggiuntivi..."
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {submitting ? 'Salvando...' : editingAbsence ? 'Aggiorna' : 'Crea Assenza'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowModal(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Annulla
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ToastContainer />
      </div>
    </MainLayout>
  )
}
