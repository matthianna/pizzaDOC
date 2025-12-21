'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Plus, Edit, Trash2, Calendar, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

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
    case 'FULL_DAY': return 'Giorno intero'
    case 'PRANZO_ONLY': return 'Solo pranzo'
    case 'CENA_ONLY': return 'Solo cena'
    default: return type
  }
}

export default function HolidaysPage() {
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
        method: 'DELETE'
      })

      if (response.ok) {
        setHolidays(holidays.filter(h => h.id !== deletingHoliday.id))
        setShowDeleteConfirm(false)
        setDeletingHoliday(null)
      } else {
        const error = await response.json()
        alert(error.error || 'Errore durante l\'eliminazione')
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
      alert('Errore durante l\'eliminazione')
    }
  }

  // Genera lista di anni (3 anni passati, anno corrente, 2 anni futuri)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i)

  if (loading) {
    return (
      <MainLayout adminOnly>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout adminOnly>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-orange-600" />
              Giorni Festivi
            </h1>
            <p className="text-sm sm:text-base text-gray-800 mt-1">
              Gestisci i giorni di chiusura dell'azienda
            </p>
          </div>
          <div className="flex gap-2">
            <Select
              label=""
              options={years.map(year => ({
                value: year.toString(),
                label: year.toString()
              }))}
              value={filterYear}
              onChange={(value) => setFilterYear(value)}
            />
            <button
              onClick={() => {
                setEditingHoliday(null)
                setShowModal(true)
              }}
              className="bg-orange-600 text-white px-3 py-2 text-sm sm:px-4 sm:py-2 rounded-md hover:bg-orange-700 flex items-center justify-center whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-1 sm:mr-2" />
              Nuovo Festivo
            </button>
          </div>
        </div>

        {/* Holidays Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo Chiusura
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrizione
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {holidays.map((holiday) => (
                  <tr key={holiday.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {format(new Date(holiday.date), 'EEEE d MMMM yyyy', { locale: it })}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        holiday.closureType === 'FULL_DAY' 
                          ? 'bg-red-100 text-red-800'
                          : holiday.closureType === 'PRANZO_ONLY'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {getClosureTypeName(holiday.closureType)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <div className="text-xs sm:text-sm text-gray-700">
                        {holiday.description || '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-1 sm:space-x-2">
                        <button
                          onClick={() => {
                            setEditingHoliday(holiday)
                            setShowModal(true)
                          }}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Modifica"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(holiday)}
                          className="text-red-600 hover:text-red-900"
                          title="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {holidays.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700">Nessun giorno festivo per il {filterYear}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeletingHoliday(null)
        }}
        onConfirm={handleDeleteHoliday}
        title="Elimina Giorno Festivo"
        description="Sei sicuro di voler eliminare questo giorno festivo? Gli utenti potranno nuovamente inserire disponibilità per questo giorno."
        confirmPhrase="ELIMINA"
        confirmButtonText="Elimina"
        isDangerous={true}
        metadata={
          deletingHoliday && (
            <div className="text-sm space-y-1">
              <p><strong>Data:</strong> {format(new Date(deletingHoliday.date), 'd MMMM yyyy', { locale: it })}</p>
              <p><strong>Tipo:</strong> {getClosureTypeName(deletingHoliday.closureType)}</p>
              {deletingHoliday.description && (
                <p><strong>Descrizione:</strong> {deletingHoliday.description}</p>
              )}
            </div>
          )
        }
      />
    </MainLayout>
  )
}

// Holiday Form Modal Component
function HolidayFormModal({
  holiday,
  onClose,
  onSave
}: {
  holiday?: Holiday | null
  onClose: () => void
  onSave: () => void
}) {
  const [formData, setFormData] = useState({
    date: holiday ? holiday.date.split('T')[0] : '',
    closureType: holiday?.closureType || 'FULL_DAY',
    description: holiday?.description || ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = holiday 
        ? `/api/admin/holidays/${holiday.id}`
        : '/api/admin/holidays'
      const method = holiday ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
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

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-lg w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {holiday ? 'Modifica Giorno Festivo' : 'Nuovo Giorno Festivo'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Data"
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />

            <Select
              label="Tipo di chiusura"
              options={[
                { value: 'FULL_DAY', label: 'Giorno intero' },
                { value: 'PRANZO_ONLY', label: 'Solo pranzo' },
                { value: 'CENA_ONLY', label: 'Solo cena' }
              ]}
              value={formData.closureType}
              onChange={(value) => setFormData({ ...formData, closureType: value as any })}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione (opzionale)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Es: Natale, Capodanno, Inventario..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                isLoading={loading}
              >
                Salva
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

