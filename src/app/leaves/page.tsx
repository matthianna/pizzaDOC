'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, Plus, Edit2, Trash2, Clock, Check, X, AlertCircle } from 'lucide-react'
import { format, parseISO, isAfter, isBefore } from 'date-fns'
import { it } from 'date-fns/locale'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'

interface Leave {
  id: string
  startDate: string
  endDate: string
  type: 'VACATION' | 'SICK' | 'PERSONAL' | 'FAMILY' | 'OTHER'
  reason?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  updatedAt: string
}

const leaveTypes = {
  VACATION: 'Vacanze',
  SICK: 'Malattia',
  PERSONAL: 'Permesso Personale',
  FAMILY: 'Emergenza Familiare',
  OTHER: 'Altro'
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800'
}

const statusIcons = {
  PENDING: Clock,
  APPROVED: Check,
  REJECTED: X
}

const statusLabels = {
  PENDING: 'In Attesa',
  APPROVED: 'Approvato',
  REJECTED: 'Rifiutato'
}

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null)
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    type: 'VACATION' as keyof typeof leaveTypes,
    reason: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    fetchLeaves()
  }, [])

  const fetchLeaves = async () => {
    try {
      const response = await fetch('/api/user/leaves')
      if (response.ok) {
        const data = await response.json()
        setLeaves(data)
      } else {
        showToast('Errore nel caricamento delle assenze', 'error')
      }
    } catch (error) {
      showToast('Errore di connessione', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingLeave 
        ? `/api/user/leaves/${editingLeave.id}`
        : '/api/user/leaves'
      
      const method = editingLeave ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        showToast(
          editingLeave ? 'Assenza modificata con successo' : 'Assenza creata con successo',
          'success'
        )
        setShowModal(false)
        setEditingLeave(null)
        resetForm()
        fetchLeaves()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'operazione', 'error')
      }
    } catch (error) {
      showToast('Errore di connessione', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (leave: Leave) => {
    setEditingLeave(leave)
    setFormData({
      startDate: format(parseISO(leave.startDate), 'yyyy-MM-dd'),
      endDate: format(parseISO(leave.endDate), 'yyyy-MM-dd'),
      type: leave.type,
      reason: leave.reason || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (leave: Leave) => {
    if (!confirm('Sei sicuro di voler eliminare questa richiesta di assenza?')) {
      return
    }

    try {
      const response = await fetch(`/api/user/leaves/${leave.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showToast('Assenza eliminata con successo', 'success')
        fetchLeaves()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'eliminazione', 'error')
      }
    } catch (error) {
      showToast('Errore di connessione', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      startDate: '',
      endDate: '',
      type: 'VACATION',
      reason: ''
    })
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingLeave(null)
    resetForm()
  }

  const isPastLeave = (leave: Leave) => {
    return isBefore(parseISO(leave.startDate), new Date())
  }

  const canModify = (leave: Leave) => {
    return !isPastLeave(leave) && leave.status !== 'REJECTED'
  }

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
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-6 w-6 text-orange-500 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Le Mie Assenze</h1>
              <p className="text-gray-600">Gestisci le tue richieste di vacanze e assenze</p>
            </div>
          </div>
          <Button
            onClick={() => setShowModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuova Richiesta
          </Button>
        </div>

        {/* Leaves List */}
        <div className="bg-white rounded-lg shadow">
          {leaves.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nessuna assenza programmata
              </h3>
              <p className="text-gray-600 mb-4">
                Non hai ancora creato richieste di assenza o vacanze.
              </p>
              <Button
                onClick={() => setShowModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crea Prima Richiesta
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {leaves.map((leave) => {
                const StatusIcon = statusIcons[leave.status]
                const isPast = isPastLeave(leave)
                const canEdit = canModify(leave)

                return (
                  <div
                    key={leave.id}
                    className={`p-6 ${isPast ? 'opacity-75 bg-gray-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {leaveTypes[leave.type]}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[leave.status]}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusLabels[leave.status]}
                          </span>
                          {isPast && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <Clock className="h-3 w-3 mr-1" />
                              Passato
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-2">
                          <strong>Dal:</strong> {format(parseISO(leave.startDate), 'dd/MM/yyyy', { locale: it })} 
                          {' '} <strong>Al:</strong> {format(parseISO(leave.endDate), 'dd/MM/yyyy', { locale: it })}
                        </div>
                        
                        {leave.reason && (
                          <div className="text-sm text-gray-600 mb-2">
                            <strong>Motivo:</strong> {leave.reason}
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500">
                          Richiesta inviata il {format(parseISO(leave.createdAt), 'dd/MM/yyyy HH:mm', { locale: it })}
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleEdit(leave)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifica"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(leave)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            title="Elimina"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingLeave ? 'Modifica Assenza' : 'Nuova Richiesta Assenza'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Tipo di Assenza
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as keyof typeof leaveTypes })}
                    className="w-full px-4 py-3 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    required
                  >
                    {Object.entries(leaveTypes).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Data Inizio
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-3 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      required
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Data Fine
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-4 py-3 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      required
                      min={formData.startDate || format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Motivo (opzionale)
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-4 py-3 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
                    rows={3}
                    placeholder="Descrivi brevemente il motivo dell'assenza..."
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    {submitting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Invio...
                      </div>
                    ) : (
                      editingLeave ? 'Modifica Assenza' : 'Crea Richiesta'
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors"
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
