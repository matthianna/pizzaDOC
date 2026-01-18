'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, Filter, User, Edit, Trash2, X, Check, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
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

  return (
    <MainLayout title="Gestione Assenze">
      <div className="space-y-6">
        {/* Header Moderno */}
        <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-7 w-7 mr-3 text-orange-600" />
              Gestione Assenze e Vacanze
            </h1>
            <p className="text-gray-600 mt-1.5">
            Visualizza tutte le assenze programmate dai dipendenti
          </p>
          </div>
        </div>

        {/* Filtri Minimalist */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Filter className="h-5 w-5 text-orange-600" />
            </div>
            <span className="font-semibold text-gray-900">Filtri</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              label="Tutte"
            />
            <FilterButton
              active={filter === 'active'}
              onClick={() => setFilter('active')}
              label="In Corso"
              color="green"
            />
            <FilterButton
              active={filter === 'future'}
              onClick={() => setFilter('future')}
              label="Future"
              color="blue"
            />
            <FilterButton
              active={filter === 'past'}
              onClick={() => setFilter('past')}
              label="Passate"
              color="gray"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        ) : absences.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl border border-gray-200/50">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-900 font-semibold text-lg">Nessuna assenza trovata</p>
            <p className="text-sm text-gray-600 mt-2">
              {filter !== 'all' ? 'Prova a cambiare i filtri per vedere altre assenze' : 'Non ci sono assenze programmate'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {absences.map(absence => (
              <AbsenceCard 
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

        {!loading && absences.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 border border-orange-200/50 rounded-xl p-4">
            <div className="text-sm font-semibold text-orange-800 flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span>Totale: {absences.length} {absences.length === 1 ? 'assenza' : 'assenze'}</span>
            </div>
          </div>
        )}

        {/* Modal Modifica */}
        {editingAbsence && (
          <Modal
            isOpen={true}
            onClose={() => setEditingAbsence(null)}
            title="Modifica Assenza"
            subtitle={editingAbsence.user.username}
            headerIcon={<Edit className="h-6 w-6" />}
            maxWidth="md"
          >
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Data Inizio</label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Data Fine</label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Motivazione</label>
                <input
                  type="text"
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  placeholder="Es: Vacanze, Visita medica..."
                  className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Note Interne</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Appunti per l'amministrazione..."
                  rows={3}
                  className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-300 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingAbsence(null)}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-[2] py-4 bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-100 transition-all active:scale-95"
                >
                  Salva Modifiche
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal Elimina */}
        {deletingAbsence && (
          <ConfirmationModal
            isOpen={true}
            onClose={() => setDeletingAbsence(null)}
            onConfirm={handleDelete}
            title="Elimina Assenza"
            description={`Sei sicuro di voler eliminare l'assenza di ${deletingAbsence.user.username}?`}
            confirmPhrase="ELIMINA"
            confirmButtonText="Conferma Eliminazione"
            isDangerous={true}
            metadata={
              <div className="text-sm font-bold text-red-600">
                Periodo: {format(new Date(deletingAbsence.startDate), 'dd/MM/yyyy')} - {format(new Date(deletingAbsence.endDate), 'dd/MM/yyyy')}
              </div>
            }
          />
        )}

        {/* Modal Rifiuto */}
        {rejectingId && (
          <Modal
            isOpen={true}
            onClose={() => {
              setRejectingId(null)
              setRejectionReason('')
            }}
            title="Rifiuta Richiesta"
            subtitle="Indica il motivo del rifiuto"
            headerIcon={<XCircle className="h-6 w-6" />}
            maxWidth="md"
          >
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Motivazione Rifiuto</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Es: Date non disponibili, troppi collaboratori assenti..."
                  rows={4}
                  className="w-full bg-red-50/30 border-red-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all placeholder-gray-300 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(null)
                    setRejectionReason('')
                  }}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Indietro
                </button>
                <button
                  onClick={() => rejectAbsence(rejectingId)}
                  disabled={!rejectionReason.trim()}
                  className="flex-[2] py-4 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  Conferma Rifiuto
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </MainLayout>
  )
}

function FilterButton({
  active,
  onClick,
  label,
  color = 'orange'
}: {
  active: boolean
  onClick: () => void
  label: string
  color?: 'orange' | 'green' | 'blue' | 'gray'
}) {
  const activeColors = {
    orange: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200',
    green: 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-200',
    blue: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200',
    gray: 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg shadow-gray-200'
  }

  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
        active 
          ? activeColors[color] + ' scale-105'
          : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

function AbsenceCard({
  absence,
  isActive,
  isPast,
  onEdit,
  onDelete,
  onApprove,
  onReject
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

  const statusConfig = isActive 
    ? { bg: 'from-green-50 to-emerald-50/30', border: 'border-green-200/50', icon: 'text-green-600', badge: 'bg-green-500 text-white' }
    : isPast 
      ? { bg: 'from-gray-50 to-slate-50/30', border: 'border-gray-200/50', icon: 'text-gray-500', badge: 'bg-gray-400 text-white' }
      : { bg: 'from-blue-50 to-cyan-50/30', border: 'border-blue-200/50', icon: 'text-blue-600', badge: 'bg-blue-500 text-white' }

  return (
    <div className={`bg-gradient-to-br ${statusConfig.bg} rounded-2xl border ${statusConfig.border} p-5 transition-all hover:shadow-lg ${isPast ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm`}>
            <User className={`h-6 w-6 ${statusConfig.icon}`} />
          </div>
            <div>
            <h3 className="font-bold text-gray-900 text-lg">
                {absence.user.username}
              </h3>
            <span className="text-sm text-gray-600 font-medium">
                {absence.user.primaryRole}
              </span>
            </div>
          </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isActive && (
            <span className={`px-3 py-1.5 text-xs font-bold ${statusConfig.badge} rounded-lg shadow-sm`}>
              IN CORSO
            </span>
          )}
          {absence.approved ? (
            <span className="px-3 py-1.5 text-xs font-bold bg-green-500 text-white rounded-lg shadow-sm flex items-center gap-1">
              <Check className="h-3 w-3" />
              APPROVATA
            </span>
          ) : (
            <span className="px-3 py-1.5 text-xs font-bold bg-amber-500 text-white rounded-lg shadow-sm flex items-center gap-1">
              <Clock className="h-3 w-3" />
              IN ATTESA
            </span>
          )}
          
          {!absence.approved && (
            <>
              <button
                onClick={onApprove}
                className="p-2.5 text-green-600 hover:bg-green-100 rounded-xl transition-all hover:scale-105"
                title="Approva assenza"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={onReject}
                className="p-2.5 text-red-600 hover:bg-red-100 rounded-xl transition-all hover:scale-105"
                title="Rifiuta assenza"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          
          <button
            onClick={onEdit}
            className="p-2.5 text-blue-600 hover:bg-blue-100 rounded-xl transition-all hover:scale-105"
            title="Modifica assenza"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2.5 text-red-600 hover:bg-red-100 rounded-xl transition-all hover:scale-105"
            title="Elimina assenza"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="font-semibold text-gray-900">
            {format(startDate, 'dd/MM/yyyy', { locale: it })} - {format(endDate, 'dd/MM/yyyy', { locale: it })}
            </span>
          <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-lg">
            {daysDiff} {daysDiff === 1 ? 'giorno' : 'giorni'}
              </span>
          </div>
          
          {absence.reason && (
          <p className="text-sm text-gray-700">
            <strong className="text-gray-900">Motivo:</strong> {absence.reason}
            </p>
          )}
          
          {absence.notes && (
            <p className="text-sm text-gray-600">
            <strong className="text-gray-800">Note:</strong> {absence.notes}
            </p>
          )}
          </div>

      <div className="text-xs text-gray-500 mt-4 flex items-center gap-1">
        <span className="opacity-60">Creata il</span>
        <span className="font-medium">{format(new Date(absence.createdAt), 'dd/MM/yyyy HH:mm', { locale: it })}</span>
      </div>
    </div>
  )
}

