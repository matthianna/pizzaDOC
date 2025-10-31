'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Plus, Edit, Trash2, DollarSign, Calendar, User, X } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

interface Advance {
  id: string
  userId: string
  amount: number
  date: string
  notes: string | null
  createdAt: string
  user: {
    id: string
    username: string
    primaryRole: string
  }
}

interface User {
  id: string
  username: string
  primaryRole: string
}

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<Advance[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAdvance, setEditingAdvance] = useState<Advance | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingAdvance, setDeletingAdvance] = useState<Advance | null>(null)
  const [filterUserId, setFilterUserId] = useState<string>('')

  // Form state
  const [formUserId, setFormUserId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAdvances()
    fetchUsers()
  }, [])

  useEffect(() => {
    if (filterUserId) {
      fetchAdvances(filterUserId)
    } else {
      fetchAdvances()
    }
  }, [filterUserId])

  const fetchAdvances = async (userId?: string) => {
    try {
      const url = userId 
        ? `/api/admin/advances?userId=${userId}`
        : '/api/admin/advances'
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setAdvances(data)
      }
    } catch (error) {
      console.error('Error fetching advances:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        // Filtra solo utenti non-admin attivi
        const activeUsers = data.filter((u: User) => 
          u.primaryRole !== 'ADMIN' && !u.username.toLowerCase().includes('admin')
        )
        setUsers(activeUsers)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const resetForm = () => {
    setFormUserId('')
    setFormAmount('')
    setFormDate('')
    setFormNotes('')
    setEditingAdvance(null)
  }

  const openCreateForm = () => {
    resetForm()
    setShowCreateForm(true)
  }

  const openEditForm = (advance: Advance) => {
    setEditingAdvance(advance)
    setFormUserId(advance.userId)
    setFormAmount(advance.amount.toString())
    setFormDate(advance.date.split('T')[0])
    setFormNotes(advance.notes || '')
    setShowCreateForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formUserId || !formAmount || !formDate) {
      alert('Compila tutti i campi obbligatori')
      return
    }

    const amount = parseFloat(formAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('L\'importo deve essere un numero positivo')
      return
    }

    setSubmitting(true)

    try {
      const url = editingAdvance 
        ? `/api/admin/advances/${editingAdvance.id}`
        : '/api/admin/advances'
      
      const method = editingAdvance ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: formUserId,
          amount,
          date: formDate,
          notes: formNotes || null
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        if (editingAdvance) {
          setAdvances(advances.map(a => a.id === data.id ? data : a))
        } else {
          setAdvances([data, ...advances])
        }

        setShowCreateForm(false)
        resetForm()
      } else {
        const error = await response.json()
        alert(error.error || 'Errore durante il salvataggio')
      }
    } catch (error) {
      console.error('Error submitting advance:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteConfirm = (advance: Advance) => {
    setDeletingAdvance(advance)
    setShowDeleteConfirm(true)
  }

  const handleDelete = async () => {
    if (!deletingAdvance) return

    try {
      const response = await fetch(`/api/admin/advances/${deletingAdvance.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAdvances(advances.filter(a => a.id !== deletingAdvance.id))
        setShowDeleteConfirm(false)
        setDeletingAdvance(null)
      } else {
        alert('Errore durante l\'eliminazione')
      }
    } catch (error) {
      console.error('Error deleting advance:', error)
      alert('Errore durante l\'eliminazione')
    }
  }

  // Calcola totali per utente
  const getTotalByUser = () => {
    const totals: Record<string, { username: string; total: number }> = {}
    
    advances.forEach(advance => {
      if (!totals[advance.userId]) {
        totals[advance.userId] = {
          username: advance.user.username,
          total: 0
        }
      }
      totals[advance.userId].total += advance.amount
    })

    return Object.values(totals).sort((a, b) => b.total - a.total)
  }

  const filteredAdvances = filterUserId
    ? advances.filter(a => a.userId === filterUserId)
    : advances

  const totalAdvances = filteredAdvances.reduce((sum, a) => sum + a.amount, 0)

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
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-orange-600" />
              Acconti Dipendenti
            </h1>
            <p className="text-sm sm:text-base text-gray-800 mt-1">
              Gestisci gli acconti erogati ai dipendenti
            </p>
          </div>
          <button
            onClick={openCreateForm}
            className="bg-orange-600 text-white px-3 py-2 text-sm sm:px-4 sm:py-2 rounded-md hover:bg-orange-700 flex items-center justify-center"
          >
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            Nuovo Acconto
          </button>
        </div>

        {/* Filter & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white shadow rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtra per dipendente
            </label>
            <Select
              options={[
                { value: '', label: 'Tutti i dipendenti' },
                ...users.map(u => ({ value: u.id, label: u.username }))
              ]}
              value={filterUserId}
              onChange={(value) => setFilterUserId(value as string)}
            />
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-600">Totale acconti {filterUserId && '(filtrato)'}</div>
            <div className="text-2xl font-bold text-orange-600">
              CHF {totalAdvances.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {filteredAdvances.length} {filteredAdvances.length === 1 ? 'acconto' : 'acconti'}
            </div>
          </div>
        </div>

        {/* Advances List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dipendente
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Importo
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Note
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAdvances.map((advance) => (
                  <tr key={advance.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">
                          {advance.user.username}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-800">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        {format(new Date(advance.date), 'dd MMM yyyy', { locale: it })}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-orange-600">
                        CHF {advance.amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <div className="text-sm text-gray-800 max-w-xs truncate">
                        {advance.notes || '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-1 sm:space-x-2">
                        <button
                          onClick={() => openEditForm(advance)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Modifica"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(advance)}
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

          {filteredAdvances.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700">Nessun acconto trovato</p>
            </div>
          )}
        </div>

        {/* Totali per utente */}
        {!filterUserId && advances.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Totale acconti per dipendente</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {getTotalByUser().map(({ username, total }) => (
                <div key={username} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-900">{username}</div>
                    <div className="text-lg font-bold text-orange-600">
                      CHF {total.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingAdvance ? 'Modifica Acconto' : 'Nuovo Acconto'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Select
                  label="Dipendente *"
                  options={[
                    { value: '', label: 'Seleziona dipendente' },
                    ...users.map(u => ({ value: u.id, label: u.username }))
                  ]}
                  value={formUserId}
                  onChange={(value) => setFormUserId(value as string)}
                  disabled={!!editingAdvance}
                />

                <Input
                  label="Importo (CHF) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="100.00"
                />

                <Input
                  label="Data *"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Note aggiuntive..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowCreateForm(false)
                      resetForm()
                    }}
                  >
                    Annulla
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? 'Salvataggio...' : editingAdvance ? 'Salva Modifiche' : 'Crea Acconto'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && deletingAdvance && (
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false)
            setDeletingAdvance(null)
          }}
          onConfirm={handleDelete}
          title="Elimina Acconto"
          description={`Sei sicuro di voler eliminare l'acconto di CHF ${deletingAdvance.amount.toFixed(2)} per ${deletingAdvance.user.username}?`}
          confirmPhrase="ELIMINA"
          confirmButtonText="Elimina"
          isDangerous={true}
        />
      )}
    </MainLayout>
  )
}

