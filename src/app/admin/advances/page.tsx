'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { Plus, Edit, Trash2, DollarSign, Calendar, User, X, Info, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
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

  useEffect(() => {
    if (!showCreateForm) return
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [showCreateForm])

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
        const list = Array.isArray(data) ? data : (data.users ?? [])
        // Filtra solo utenti non-admin attivi
        const activeUsers = list.filter((u: User) => 
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--pd-accent)]"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout adminOnly>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Moderno */}
        <div className="bg-[var(--pd-surface)] rounded-3xl shadow-[var(--pd-shadow)] border border-[var(--pd-border)] p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-[var(--pd-accent)] rounded-2xl shadow-lg shadow-[var(--pd-shadow)]">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="pd-display text-3xl font-semibold text-[var(--pd-text)] tracking-tight">
                  Acconti Dipendenti
                </h1>
                <p className="text-[var(--pd-muted)] font-medium mt-1">
                  Gestione e monitoraggio degli acconti erogati alla squadra.
                </p>
              </div>
            </div>
            <button
              onClick={openCreateForm}
              className="bg-[var(--pd-accent)] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[var(--pd-accent-hover)] shadow-lg shadow-[var(--pd-shadow)] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuovo Acconto
            </button>
          </div>
        </div>

        {/* Filter & Global Stats Moderni */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-[var(--pd-surface)] rounded-3xl shadow-[var(--pd-shadow)] border border-[var(--pd-border)] p-6">
            <label className="block text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-widest mb-3 px-1">
              Filtra per dipendente
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pd-muted)]" />
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[var(--pd-surface-muted)] border-[var(--pd-border)] rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] transition-all appearance-none"
              >
                <option value="">Tutti i dipendenti</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lg:col-span-2 bg-[var(--pd-accent)] rounded-3xl shadow-lg shadow-[var(--pd-shadow)] p-6 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp className="h-24 w-24 text-white" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-[var(--pd-accent-fg)]/80 uppercase tracking-widest mb-1">
                Totale Erogato {filterUserId && '(Filtrato)'}
              </p>
              <p className="text-4xl font-black text-white tracking-tight">
                CHF {totalAdvances.toFixed(2)}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-3 text-right relative z-10 border border-white/20">
              <p className="text-[10px] font-black text-[var(--pd-accent-fg)]/80 uppercase tracking-widest">Operazioni</p>
              <p className="text-xl font-black text-white">{filteredAdvances.length}</p>
            </div>
          </div>
        </div>

        {/* Totali per utente Moderni */}
        {!filterUserId && advances.length > 0 && (
          <div className="bg-[var(--pd-surface)] rounded-3xl shadow-[var(--pd-shadow)] border border-[var(--pd-border)] p-8">
            <h3 className="text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-6">Riepilogo per dipendente</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {getTotalByUser().map(({ username, total }) => (
                <div key={username} className="bg-[var(--pd-surface-muted)] rounded-2xl p-4 border border-[var(--pd-border)] hover:shadow-md transition-all">
                  <p className="text-[10px] font-black text-[var(--pd-muted)] uppercase tracking-widest mb-1 truncate">{username}</p>
                  <p className="text-lg font-black text-[var(--pd-text)] tracking-tight">CHF {total.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advances List Moderna */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAdvances.length === 0 ? (
            <div className="col-span-full bg-[var(--pd-surface)] rounded-3xl shadow-[var(--pd-shadow)] border border-dashed border-[var(--pd-border-strong)] p-20 text-center">
              <div className="p-4 bg-[var(--pd-surface-muted)] rounded-full w-fit mx-auto mb-4">
                <DollarSign className="h-10 w-10 text-[var(--pd-muted)]/50" />
              </div>
              <p className="text-[var(--pd-muted)] font-bold uppercase tracking-widest text-sm">Nessun acconto trovato</p>
            </div>
          ) : (
            filteredAdvances.map((advance) => (
              <div key={advance.id} className="bg-[var(--pd-surface)] rounded-3xl shadow-[var(--pd-shadow)] border border-[var(--pd-border)] p-6 hover:shadow-xl transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--pd-accent-soft)] flex items-center justify-center font-black text-[var(--pd-accent)] text-sm border-2 border-white shadow-sm">
                      {advance.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-[var(--pd-text)]">{advance.user.username}</p>
                      <p className="text-[10px] font-bold text-[var(--pd-muted)] uppercase">{getRoleName(advance.user.primaryRole)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-[var(--pd-accent)] tracking-tight">CHF {advance.amount.toFixed(2)}</p>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-[var(--pd-muted)] uppercase">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(advance.date), 'd MMM yyyy', { locale: it })}
                    </div>
                  </div>
                </div>

                {advance.notes && (
                  <div className="mb-6 bg-[var(--pd-surface-muted)] p-4 rounded-2xl border border-[var(--pd-border)] relative">
                    <p className="text-xs text-[var(--pd-muted)] font-medium leading-relaxed italic">
                      &quot;{advance.notes}&quot;
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-4 border-t border-[var(--pd-border)]">
                  <button
                    onClick={() => openEditForm(advance)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--pd-surface-muted)] text-[var(--pd-accent)] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[var(--pd-accent-soft)] transition-all"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Modifica
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(advance)}
                    className="px-4 py-2.5 bg-[var(--pd-danger-soft)] text-[var(--pd-danger)] rounded-xl hover:bg-[var(--pd-danger-soft)] transition-all"
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

      {/* Create/Edit — stesso linguaggio visivo del modal eliminazione (ConfirmationModal) */}
      {showCreateForm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center box-border"
            style={{
              height: '100dvh',
              paddingTop: 'max(1rem, env(safe-area-inset-top))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left))',
              paddingRight: 'max(1rem, env(safe-area-inset-right))',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="advance-form-title"
          >
            <button
              type="button"
              aria-label="Chiudi"
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
              onClick={() => {
                if (!submitting) {
                  setShowCreateForm(false)
                  resetForm()
                }
              }}
            />
            <div
              className="relative bg-[var(--pd-surface)] rounded-[48px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-[var(--pd-border)]"
              style={{
                maxHeight:
                  'min(90dvh, calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 px-8 sm:px-12 pt-8 pb-6 border-b border-[var(--pd-border)] shrink-0">
                <h2
                  id="advance-form-title"
                  className="text-2xl sm:text-[28px] font-black text-[var(--pd-text)] tracking-tight leading-tight pr-2"
                >
                  {editingAdvance ? 'Modifica Acconto' : 'Nuovo Acconto'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!submitting) {
                      setShowCreateForm(false)
                      resetForm()
                    }
                  }}
                  disabled={submitting}
                  className="p-3 bg-[var(--pd-surface-muted)] rounded-2xl text-[var(--pd-muted)] hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-50"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="px-8 sm:px-12 py-6 overflow-y-auto flex-1 space-y-6">
                  <div className="bg-[var(--pd-accent-soft)]/50 p-5 rounded-2xl border border-[var(--pd-border)]">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-[var(--pd-accent)] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[var(--pd-shadow)] shrink-0">
                        <Info className="h-6 w-6" />
                      </div>
                      <p className="text-sm text-[var(--pd-text)] font-medium leading-relaxed pt-0.5">
                        {editingAdvance
                          ? `Aggiorna importo, data o note per l'acconto di ${editingAdvance.user.username}.`
                          : 'Registra un acconto in CHF per il dipendente selezionato. I campi contrassegnati da * sono obbligatori.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-3 px-0.5">
                      Dipendente <span className="text-[var(--pd-accent)]">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--pd-muted)] pointer-events-none z-10" />
                      <select
                        value={formUserId}
                        onChange={(e) => setFormUserId(e.target.value)}
                        disabled={!!editingAdvance || submitting}
                        className={cn(
                          'w-full appearance-none border-2 border-[var(--pd-border)] rounded-2xl pl-12 pr-10 py-3.5 text-[var(--pd-text)] bg-[var(--pd-surface-muted)] font-bold text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all',
                          (editingAdvance || submitting) && 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        <option value="">Seleziona dipendente</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--pd-muted)]">
                        <ChevronDown className="h-5 w-5" aria-hidden />
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-3 px-0.5">
                      Importo (CHF) <span className="text-[var(--pd-accent)]">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--pd-muted)] pointer-events-none" />
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="100.00"
                        disabled={submitting}
                        className="w-full border-2 border-[var(--pd-border)] rounded-2xl pl-12 pr-5 py-3.5 text-[var(--pd-text)] bg-[var(--pd-surface-muted)] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all placeholder:text-[var(--pd-muted)]/50 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-3 px-0.5">
                      Data <span className="text-[var(--pd-accent)]">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--pd-muted)] pointer-events-none" />
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        disabled={submitting}
                        className="w-full border-2 border-[var(--pd-border)] rounded-2xl pl-12 pr-5 py-3.5 text-[var(--pd-text)] bg-[var(--pd-surface-muted)] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-3 px-0.5">
                      Note <span className="text-[var(--pd-muted)]/50 font-bold normal-case tracking-normal">(facoltativo)</span>
                    </label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Note aggiuntive..."
                      rows={3}
                      disabled={submitting}
                      className="w-full border-2 border-[var(--pd-border)] rounded-2xl px-5 py-3.5 text-[var(--pd-text)] bg-[var(--pd-surface-muted)] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all placeholder:text-[var(--pd-muted)]/50 resize-none disabled:opacity-60"
                    />
                  </div>

                  <p className="text-xs text-[var(--pd-text)] font-medium bg-[var(--pd-accent-soft)] px-4 py-3 rounded-xl flex items-center gap-2 border border-[var(--pd-border)]">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--pd-accent)]" />
                    Verifica importo e data prima di salvare: l&apos;acconto comparirà nei totali e nelle schede dipendente.
                  </p>
                </div>

                <div className="flex justify-end gap-3 px-8 sm:px-12 pt-4 pb-8 border-t border-[var(--pd-border)] shrink-0 bg-[var(--pd-surface)]">
                  <button
                    type="button"
                    onClick={() => {
                      if (!submitting) {
                        setShowCreateForm(false)
                        resetForm()
                      }
                    }}
                    disabled={submitting}
                    className="px-6 py-3 text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest hover:bg-[var(--pd-surface-muted)] rounded-xl transition-all disabled:opacity-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3 bg-[var(--pd-accent)] text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--pd-shadow)] hover:bg-[var(--pd-accent-hover)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 min-w-[11rem]"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Salvataggio…
                      </>
                    ) : editingAdvance ? (
                      'Salva modifiche'
                    ) : (
                      'Crea acconto'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
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

