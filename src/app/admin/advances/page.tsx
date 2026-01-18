'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Plus, Edit, Trash2, DollarSign, Calendar, User, X } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Moderno */}
        <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-orange-600 rounded-2xl shadow-lg shadow-orange-200">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  Acconti Dipendenti
                </h1>
                <p className="text-gray-500 font-medium mt-1">
                  Gestione e monitoraggio degli acconti erogati alla squadra.
                </p>
              </div>
            </div>
            <button
              onClick={openCreateForm}
              className="bg-orange-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuovo Acconto
            </button>
          </div>
        </div>

        {/* Filter & Global Stats Moderni */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-3xl shadow-soft border border-gray-100 p-6">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
              Filtra per dipendente
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-gray-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all appearance-none"
              >
                <option value="">Tutti i dipendenti</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gradient-to-br from-orange-600 to-orange-500 rounded-3xl shadow-lg shadow-orange-200 p-6 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp className="h-24 w-24 text-white" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-orange-100 uppercase tracking-widest mb-1">
                Totale Erogato {filterUserId && '(Filtrato)'}
              </p>
              <p className="text-4xl font-black text-white tracking-tight">
                CHF {totalAdvances.toFixed(2)}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-3 text-right relative z-10 border border-white/20">
              <p className="text-[10px] font-black text-orange-50 uppercase tracking-widest">Operazioni</p>
              <p className="text-xl font-black text-white">{filteredAdvances.length}</p>
            </div>
          </div>
        </div>

        {/* Totali per utente Moderni */}
        {!filterUserId && advances.length > 0 && (
          <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Riepilogo per dipendente</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {getTotalByUser().map(({ username, total }) => (
                <div key={username} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 hover:shadow-md transition-all">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate">{username}</p>
                  <p className="text-lg font-black text-gray-900 tracking-tight">CHF {total.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advances List Moderna */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAdvances.length === 0 ? (
            <div className="col-span-full bg-white rounded-3xl shadow-soft border border-dashed border-gray-300 p-20 text-center">
              <div className="p-4 bg-gray-50 rounded-full w-fit mx-auto mb-4">
                <DollarSign className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Nessun acconto trovato</p>
            </div>
          ) : (
            filteredAdvances.map((advance) => (
              <div key={advance.id} className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6 hover:shadow-xl transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center font-black text-orange-600 text-sm border-2 border-white shadow-sm">
                      {advance.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{advance.user.username}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">{getRoleName(advance.user.primaryRole)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-orange-600 tracking-tight">CHF {advance.amount.toFixed(2)}</p>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-gray-400 uppercase">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(advance.date), 'd MMM yyyy', { locale: it })}
                    </div>
                  </div>
                </div>

                {advance.notes && (
                  <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100 relative">
                    <p className="text-xs text-gray-600 font-medium leading-relaxed italic">
                      &quot;{advance.notes}&quot;
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
                  <button
                    onClick={() => openEditForm(advance)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Modifica
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(advance)}
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

