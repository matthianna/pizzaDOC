'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Plus, Edit, Trash2, Calendar, X, ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Moderno */}
        <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-orange-600 rounded-2xl shadow-lg shadow-orange-200">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  Giorni Festivi
                </h1>
                <p className="text-gray-500 font-medium mt-1">
                  Gestisci i giorni di chiusura dell&apos;azienda e i periodi di festa.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-1 rounded-xl flex items-center">
                {years.map(year => (
                  <button
                    key={year}
                    onClick={() => setFilterYear(year.toString())}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-black transition-all",
                      filterYear === year.toString()
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setEditingHoliday(null)
                  setShowModal(true)
                }}
                className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Nuovo Festivo
              </button>
            </div>
          </div>
        </div>

        {/* Holidays Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {holidays.length === 0 ? (
            <div className="col-span-full bg-white rounded-3xl shadow-soft border border-dashed border-gray-300 p-20 text-center">
              <div className="p-4 bg-gray-50 rounded-full w-fit mx-auto mb-4">
                <Calendar className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Nessun giorno festivo per il {filterYear}</p>
            </div>
          ) : (
            holidays.map((holiday) => (
              <div key={holiday.id} className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6 hover:shadow-xl transition-all group relative overflow-hidden">
                <div className={cn(
                  "absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-110",
                  holiday.closureType === 'FULL_DAY' ? "bg-red-500" :
                  holiday.closureType === 'PRANZO_ONLY' ? "bg-yellow-500" : "bg-blue-500"
                )} />
                
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Festività</p>
                    <h3 className="text-lg font-black text-gray-900 leading-tight">
                      {format(new Date(holiday.date), 'EEEE', { locale: it })}
                      <br />
                      <span className="text-orange-600">{format(new Date(holiday.date), 'd MMMM yyyy', { locale: it })}</span>
                    </h3>
                  </div>
                  <span className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm",
                    holiday.closureType === 'FULL_DAY' ? "bg-red-50 text-red-700 border border-red-100" :
                    holiday.closureType === 'PRANZO_ONLY' ? "bg-yellow-50 text-yellow-700 border border-yellow-100" :
                    "bg-blue-50 text-blue-700 border border-blue-100"
                  )}>
                    {getClosureTypeName(holiday.closureType)}
                  </span>
                </div>

                {holiday.description && (
                  <div className="mb-6">
                    <p className="text-xs font-medium text-gray-600 leading-relaxed italic bg-gray-50 p-3 rounded-xl border border-gray-100">
                      &quot;{holiday.description}&quot;
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
                  <button
                    onClick={() => {
                      setEditingHoliday(holiday)
                      setShowModal(true)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Modifica
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(holiday)}
                    className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                    title="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
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
    <Modal
      isOpen={true}
      onClose={onClose}
      title={holiday ? 'Modifica Festivo' : 'Nuova Festività'}
      subtitle={holiday ? 'Aggiorna i dettagli della chiusura' : 'Imposta una nuova data di chiusura'}
      headerIcon={<Calendar className="h-6 w-6" />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-8 pt-4">
        {/* Data section */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Data Chiusura</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
          />
        </div>

        {/* Closure Type section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Modalità Chiusura</label>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'FULL_DAY', label: 'Giorno Intero', desc: 'Chiuso sia a pranzo che a cena' },
              { id: 'PRANZO_ONLY', label: 'Solo Pranzo', desc: 'Aperto regolarmente a cena' },
              { id: 'CENA_ONLY', label: 'Solo Cena', desc: 'Aperto regolarmente a pranzo' }
            ].map((type) => (
              <label 
                key={type.id} 
                className={cn(
                  "flex items-center justify-between p-4 border-2 rounded-2xl cursor-pointer transition-all",
                  formData.closureType === type.id
                    ? "bg-orange-50 border-orange-500 shadow-sm"
                    : "bg-white border-gray-100 hover:border-gray-200"
                )}
              >
                <div>
                  <p className="text-sm font-black text-gray-900">{type.label}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{type.desc}</p>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                  formData.closureType === type.id ? "bg-orange-500 border-orange-500" : "border-gray-200"
                )}>
                  {formData.closureType === type.id && <Check className="h-3 w-3 text-white stroke-[4]" />}
                </div>
                <input
                  type="radio"
                  name="closureType"
                  className="hidden"
                  checked={formData.closureType === type.id}
                  onChange={() => setFormData({ ...formData, closureType: type.id as any })}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Description section */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Motivazione (Opzionale)</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            placeholder="Es: Vacanze estive, Manutenzione straordinaria..."
            className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-300 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] py-4 bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : 'Salva Festività'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

