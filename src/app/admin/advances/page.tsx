'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Plus, Edit, Trash2, DollarSign, User, Info, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, cn } from '@/lib/utils'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState, ListRow } from '@/components/ui/list-row'

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
      <MainLayout adminOnly contentWidth="6xl">
        <div className="pd-page py-16 flex justify-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2"
            style={{ borderColor: 'var(--pd-accent)' }}
          />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <div className="pd-page pb-16">
        <PageHeader
          dense
          title="Acconti"
          subtitle="Gestione acconti erogati ai dipendenti"
          action={
            <button
              type="button"
              onClick={openCreateForm}
              className="pd-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Nuovo acconto
            </button>
          }
        />

        <div
          className="flex flex-col sm:flex-row sm:items-center gap-3 p-3"
          style={{
            background: 'var(--pd-surface)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-lg)',
          }}
        >
          <label className="text-xs font-semibold shrink-0" style={{ color: 'var(--pd-muted)' }}>
            Dipendente
          </label>
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--pd-muted)' }} />
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm font-medium border appearance-none"
              style={{
                background: 'var(--pd-surface-muted)',
                borderColor: 'var(--pd-border)',
                borderRadius: 'var(--pd-radius)',
                color: 'var(--pd-text)',
              }}
            >
              <option value="">Tutti i dipendenti</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </div>
        </div>

        <StatStrip
          items={[
            { label: 'Totale erogato', value: `CHF ${totalAdvances.toFixed(0)}` },
            { label: 'Operazioni', value: filteredAdvances.length },
            { label: 'Dipendenti', value: getTotalByUser().length },
          ]}
        />

        {!filterUserId && advances.length > 0 && (
          <SectionBlock title="Riepilogo per dipendente" card>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px" style={{ background: 'var(--pd-border)' }}>
              {getTotalByUser().map(({ username, total }) => (
                <div key={username} className="px-3 py-3" style={{ background: 'var(--pd-surface)' }}>
                  <p className="text-xs truncate" style={{ color: 'var(--pd-muted)' }}>
                    {username}
                  </p>
                  <p className="text-sm font-semibold tabular-nums mt-0.5" style={{ color: 'var(--pd-text)' }}>
                    CHF {total.toFixed(0)}
                  </p>
                </div>
              ))}
            </div>
          </SectionBlock>
        )}

        <SectionBlock title="Elenco acconti" card>
          {filteredAdvances.length === 0 ? (
            <EmptyState
              title="Nessun acconto trovato"
              description="Crea un nuovo acconto o cambia il filtro dipendente."
              icon={<DollarSign className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
            />
          ) : (
            <div>
              {filteredAdvances.map((advance) => (
                <ListRow
                  key={advance.id}
                  title={advance.user.username}
                  subtitle={`${getRoleName(advance.user.primaryRole)} · ${format(new Date(advance.date), 'd MMM yyyy', { locale: it })}${advance.notes ? ` · ${advance.notes}` : ''}`}
                  meta={`CHF ${advance.amount.toFixed(2)}`}
                  trailing={
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(advance)}
                        className="p-2 pd-press"
                        title="Modifica"
                        style={{ color: 'var(--pd-muted)', borderRadius: 'var(--pd-radius-sm)' }}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteConfirm(advance)}
                        className="p-2 pd-press"
                        title="Elimina"
                        style={{ color: 'var(--pd-danger)', borderRadius: 'var(--pd-radius-sm)' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </SectionBlock>
      </div>

      {/* Create/Edit */}
      <Modal
        isOpen={showCreateForm}
        onClose={() => {
          if (!submitting) {
            setShowCreateForm(false)
            resetForm()
          }
        }}
        title={editingAdvance ? 'Modifica Acconto' : 'Nuovo Acconto'}
        subtitle={editingAdvance ? `Aggiorna i dettagli dell'acconto di ${editingAdvance.user.username}` : 'Registra un acconto per un dipendente'}
        headerIcon={<DollarSign className="h-6 w-6" />}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="p-4 rounded-xl border border-[var(--pd-border)]" style={{ background: 'var(--pd-accent-soft)' }}>
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--pd-accent)' }} />
              <p className="text-sm text-[var(--pd-text)] font-medium leading-relaxed">
                {editingAdvance
                  ? `Aggiorna importo, data o note per l'acconto di ${editingAdvance.user.username}.`
                  : 'Registra un acconto in CHF per il dipendente selezionato. I campi contrassegnati da * sono obbligatori.'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--pd-muted)]  mb-3 px-0.5">
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
            <label className="block text-xs font-semibold text-[var(--pd-muted)]  mb-3 px-0.5">
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
            <label className="block text-xs font-semibold text-[var(--pd-muted)]  mb-3 px-0.5">
              Data <span className="text-[var(--pd-accent)]">*</span>
            </label>
            <DatePicker
              value={formDate}
              onChange={setFormDate}
              disabled={submitting}
              required
              className="[&_button]:rounded-2xl [&_button]:border-2 [&_button]:py-3.5 [&_button]:font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--pd-muted)]  mb-3 px-0.5">
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

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (!submitting) {
                  setShowCreateForm(false)
                  resetForm()
                }
              }}
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-semibold text-[var(--pd-muted)] hover:bg-[var(--pd-surface-muted)] rounded-xl transition-all disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="pd-btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 min-w-[10rem]"
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
      </Modal>

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

