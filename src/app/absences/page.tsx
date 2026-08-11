'use client'

import { useState, useEffect, useMemo, type ElementType, type ReactNode } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { StaffPageHeader } from '@/components/layout/staff-page-header'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useHaptics } from '@/hooks/use-haptics'
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Info,
  Clock,
  CalendarDays,
  ChevronDown,
  Palmtree,
  History,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { shortWeekdayItFromDate } from '@/lib/date-utils'

interface Absence {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  notes: string | null
  approved: boolean
  createdAt: string
  updatedAt: string
}

type AbsenceStatus = 'active' | 'future' | 'past'

function countAbsenceDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function isInPast(absence: Absence): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(absence.endDate) < today
}

function isActive(absence: Absence): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(absence.startDate)
  const end = new Date(absence.endDate)
  return start <= today && end >= today
}

function getAbsenceStatus(absence: Absence): AbsenceStatus {
  if (isActive(absence)) return 'active'
  if (isInPast(absence)) return 'past'
  return 'future'
}

export default function AbsencesPage() {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const { showToast, ToastContainer } = useToast()
  const { lightClick } = useHaptics()

  useEffect(() => {
    fetchAbsences()
  }, [])

  const fetchAbsences = async () => {
    try {
      const response = await fetch('/api/user/absences')
      if (response.ok) {
        const data = await response.json()
        setAbsences(data)
      } else {
        showToast('Impossibile caricare le assenze', 'error')
      }
    } catch (error) {
      console.error('Error fetching absences:', error)
      showToast('Impossibile caricare le assenze', 'error')
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
    lightClick()
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
        notes: notes || null,
      }

      const response = editingAbsence
        ? await fetch(`/api/user/absences/${editingAbsence.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/user/absences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (response.ok) {
        showToast(editingAbsence ? 'Assenza aggiornata' : 'Assenza creata', 'success')
        resetForm()
        fetchAbsences()
      } else {
        const data = await response.json()
        showToast(data.error || 'Operazione fallita', 'error')
      }
    } catch (error) {
      console.error('Error submitting absence:', error)
      showToast('Impossibile salvare l\'assenza', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    try {
      const response = await fetch(`/api/user/absences/${id}`, { method: 'DELETE' })

      if (response.ok) {
        showToast('Assenza eliminata', 'success')
        fetchAbsences()
      } else {
        const data = await response.json()
        showToast(data.error || 'Impossibile eliminare l\'assenza', 'error')
      }
    } catch (error) {
      console.error('Error deleting absence:', error)
      showToast('Impossibile eliminare l\'assenza', 'error')
    } finally {
      setDeleteId(null)
    }
  }

  const { activeAbsences, futureAbsences, pastAbsences } = useMemo(() => {
    const active: Absence[] = []
    const future: Absence[] = []
    const past: Absence[] = []

    for (const absence of absences) {
      const status = getAbsenceStatus(absence)
      if (status === 'active') active.push(absence)
      else if (status === 'future') future.push(absence)
      else past.push(absence)
    }

    const byStart = (a: Absence, b: Absence) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()

    return {
      activeAbsences: active.sort(byStart),
      futureAbsences: future.sort(byStart),
      pastAbsences: past.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    }
  }, [absences])

  const futureDays = futureAbsences.reduce(
    (sum, a) => sum + countAbsenceDays(a.startDate, a.endDate),
    0
  )
  const pastDays = pastAbsences.reduce(
    (sum, a) => sum + countAbsenceDays(a.startDate, a.endDate),
    0
  )

  return (
    <MainLayout>
      <ConfirmDialog
        isOpen={!!deleteId}
        title="Elimina assenza"
        description="Vuoi eliminare questa richiesta di assenza? L’azione non si può annullare."
        confirmLabel="Elimina"
        isDangerous
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        <div className="pd-card p-6 sm:p-8">
          <StaffPageHeader
            title="Assenze e vacanze"
            subtitle="Richiedi un periodo di riposo. Resta in attesa di approvazione dall'amministrazione."
            action={
              <button
                onClick={() => {
                  lightClick()
                  setShowForm(true)
                }}
                className="px-6 py-3 pd-btn-primary rounded-2xl text-sm flex items-center gap-2 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Nuova assenza
              </button>
            }
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-28 rounded-[2rem]" />
              <Skeleton className="h-28 rounded-[2rem]" />
              <Skeleton className="h-28 rounded-[2rem]" />
            </>
          ) : (
            <>
              <StatCard
                label="In Corso"
                value={activeAbsences.length}
                icon={Clock}
                color="green"
              />
              <StatCard
                label="Programmate"
                value={futureAbsences.length}
                icon={CalendarDays}
                color="blue"
              />
              <StatCard
                label="Giorni Programmati"
                value={futureDays + activeAbsences.reduce((s, a) => s + countAbsenceDays(a.startDate, a.endDate), 0)}
                icon={Palmtree}
                color="orange"
              />
            </>
          )}
        </div>

        {/* Info Banner */}
        <div className="bg-white rounded-[2rem] shadow-soft border border-blue-100 p-5 sm:p-6 flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Info className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-black text-blue-900 text-sm uppercase tracking-tight">Informazioni importanti</p>
            <p className="text-blue-700/90 text-sm mt-1 font-medium leading-relaxed">
              Le richieste restano in attesa finché un admin non le approva. Solo dopo l’approvazione
              la disponibilità di quei giorni viene disabilitata. Le assenze approvate non si possono
              modificare o eliminare da qui.
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-[2rem]" />
            <Skeleton className="h-32 rounded-[2rem]" />
          </div>
        ) : absences.length === 0 ? (
          <div className="bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100 py-20 text-center">
            <CalendarDays className="h-16 w-16 text-gray-200 mx-auto mb-6" />
            <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Nessuna assenza programmata</p>
            <p className="text-gray-500 text-sm font-medium mt-2">Clicca su &quot;Nuova Assenza&quot; per aggiungerne una</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAbsences.length > 0 && (
              <AbsenceSection
                title="In Corso"
                subtitle={`${activeAbsences.length} ${activeAbsences.length === 1 ? 'assenza attiva' : 'assenze attive'}`}
                icon={Clock}
                accent="green"
                isExpanded
                onToggle={() => {}}
                hideToggle
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {activeAbsences.map(absence => (
                    <AbsenceCard
                      key={absence.id}
                      absence={absence}
                      status="active"
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </AbsenceSection>
            )}

            {futureAbsences.length > 0 && (
              <AbsenceSection
                title="Programmate"
                subtitle={`${futureAbsences.length} ${futureAbsences.length === 1 ? 'assenza' : 'assenze'} · ${futureDays} giorni`}
                icon={CalendarDays}
                accent="blue"
                isExpanded
                onToggle={() => {}}
                hideToggle={activeAbsences.length === 0 && futureAbsences.length <= 3}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {futureAbsences.map(absence => (
                    <AbsenceCard
                      key={absence.id}
                      absence={absence}
                      status="future"
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </AbsenceSection>
            )}

            {pastAbsences.length > 0 && (
              <AbsenceSection
                title="Storico Assenze"
                subtitle={`${pastAbsences.length} ${pastAbsences.length === 1 ? 'periodo' : 'periodi'} · ${pastDays} giorni totali`}
                icon={History}
                accent="gray"
                isExpanded={showHistory}
                onToggle={() => {
                  lightClick()
                  setShowHistory(prev => !prev)
                }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {pastAbsences.map(absence => (
                    <AbsenceCard
                      key={absence.id}
                      absence={absence}
                      status="past"
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </AbsenceSection>
            )}
          </div>
        )}

        {showForm && (
          <Modal
            isOpen
            onClose={resetForm}
            title={editingAbsence ? 'Modifica Assenza' : 'Nuova Assenza'}
            subtitle={editingAbsence ? 'Aggiorna i dettagli' : 'Comunica il tuo periodo di assenza'}
            headerIcon={editingAbsence ? <Edit2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            maxWidth="md"
          >
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                    Data Inizio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                    Data Fine
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || format(new Date(), 'yyyy-MM-dd')}
                    required
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                  Motivo <span className="text-gray-300">(opzionale)</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all appearance-none"
                >
                  <option value="">Seleziona motivo...</option>
                  <option value="Vacanza">Vacanza</option>
                  <option value="Malattia">Malattia</option>
                  <option value="Personale">Personale</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                  Note <span className="text-gray-300">(opzionale)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all resize-none placeholder-gray-400"
                  placeholder="Note aggiuntive..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] py-4 pd-btn-primary text-sm rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    editingAbsence ? 'Salva Modifiche' : 'Crea Assenza'
                  )}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: ElementType
  color: 'orange' | 'blue' | 'green'
}) {
  const colors = {
    orange: 'bg-orange-50 text-orange-600 shadow-orange-100',
    blue: 'bg-blue-50 text-blue-600 shadow-blue-100',
    green: 'bg-green-50 text-green-600 shadow-green-100',
  }

  return (
    <div className="pd-card p-6 flex items-center gap-5">
      <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg', colors[color])}>
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
      </div>
    </div>
  )
}

function AbsenceSection({
  title,
  subtitle,
  icon: Icon,
  accent,
  isExpanded,
  onToggle,
  hideToggle,
  children,
}: {
  title: string
  subtitle: string
  icon: ElementType
  accent: 'green' | 'blue' | 'gray'
  isExpanded: boolean
  onToggle: () => void
  hideToggle?: boolean
  children: ReactNode
}) {
  const accentStyles = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-gray-100 text-gray-500',
  }

  const Wrapper = hideToggle ? 'div' : 'button'

  return (
    <div className="pd-card overflow-hidden">
      <Wrapper
        type={hideToggle ? undefined : 'button'}
        onClick={hideToggle ? undefined : onToggle}
        className={cn(
          'w-full px-5 sm:px-6 py-5 flex items-center justify-between gap-4 text-left',
          !hideToggle && 'hover:bg-gray-50/80 transition-colors'
        )}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0', accentStyles[accent])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">{title}</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{subtitle}</p>
          </div>
        </div>
        {!hideToggle && (
          <ChevronDown className={cn('h-5 w-5 text-gray-400 transition-transform flex-shrink-0', isExpanded && 'rotate-180')} />
        )}
      </Wrapper>

      {isExpanded && <div className="px-4 sm:px-6 pb-6 pt-1">{children}</div>}
    </div>
  )
}

function AbsenceCard({
  absence,
  status,
  onEdit,
  onDelete,
}: {
  absence: Absence
  status: AbsenceStatus
  onEdit: (absence: Absence) => void
  onDelete: (id: string) => void
}) {
  const startDate = new Date(absence.startDate)
  const endDate = new Date(absence.endDate)
  const daysDiff = countAbsenceDays(absence.startDate, absence.endDate)
  const isSingleDay = daysDiff === 1

  const statusConfig = {
    active: {
      card: 'border-green-200/80 bg-gradient-to-br from-green-50/80 to-white',
      header: 'bg-green-50/70 border-green-100',
      badge: 'bg-green-500 text-white',
      iconBg: 'bg-green-100 text-green-600',
    },
    future: {
      card: 'border-blue-200/80 bg-gradient-to-br from-blue-50/80 to-white',
      header: 'bg-blue-50/70 border-blue-100',
      badge: 'bg-blue-500 text-white',
      iconBg: 'bg-blue-100 text-blue-600',
    },
    past: {
      card: 'border-gray-200/80 bg-gradient-to-br from-gray-50/60 to-white',
      header: 'bg-gray-50/70 border-gray-100',
      badge: 'bg-gray-400 text-white',
      iconBg: 'bg-gray-100 text-gray-500',
    },
  }

  const config = statusConfig[status]

  return (
    <div className={cn('rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden', config.card)}>
      <div className={cn('px-4 py-3 border-b flex items-start justify-between gap-3', config.header)}>
        <div className="flex items-center gap-3 min-w-0">
          {isSingleDay ? (
            <div className="w-11 h-11 rounded-xl bg-white border border-white/80 shadow-sm flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-black text-gray-400 uppercase leading-none">
                {shortWeekdayItFromDate(startDate).slice(0, 3)}
              </span>
              <span className="text-base font-black text-gray-900 leading-none mt-0.5">
                {startDate.getDate()}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-11 h-11 rounded-xl bg-white border border-white/80 shadow-sm flex flex-col items-center justify-center">
                <span className="text-[9px] font-black text-gray-400 uppercase leading-none">
                  {shortWeekdayItFromDate(startDate).slice(0, 3)}
                </span>
                <span className="text-base font-black text-gray-900 leading-none mt-0.5">
                  {startDate.getDate()}
                </span>
              </div>
              <span className="text-gray-300 font-black">→</span>
              <div className="w-11 h-11 rounded-xl bg-white border border-white/80 shadow-sm flex flex-col items-center justify-center">
                <span className="text-[9px] font-black text-gray-400 uppercase leading-none">
                  {shortWeekdayItFromDate(endDate).slice(0, 3)}
                </span>
                <span className="text-base font-black text-gray-900 leading-none mt-0.5">
                  {endDate.getDate()}
                </span>
              </div>
            </div>
          )}

          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 tracking-tight truncate">
              {format(startDate, 'dd/MM/yyyy', { locale: it })}
              {!isSingleDay && (
                <span className="text-gray-400 font-bold"> — {format(endDate, 'dd/MM/yyyy', { locale: it })}</span>
              )}
            </p>
            {absence.reason && (
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate mt-0.5">
                {absence.reason}
              </p>
            )}
          </div>
        </div>

        <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex-shrink-0', config.badge)}>
          {daysDiff} {daysDiff === 1 ? 'giorno' : 'giorni'}
        </span>
      </div>

      <div className="px-4 py-2 border-b border-black/5">
        <span
          className={cn(
            'inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase',
            absence.approved
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-amber-50 text-amber-700 border border-amber-100'
          )}
        >
          {absence.approved ? 'Approvata' : 'In attesa di approvazione'}
        </span>
      </div>

      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', config.iconBg)}>
            <Calendar className="h-4 w-4" />
          </div>
          {absence.notes ? (
            <p className="text-xs text-gray-500 font-medium truncate italic">{absence.notes}</p>
          ) : (
            <p className="text-xs text-gray-400 font-medium">
              {status === 'past' ? 'Periodo concluso' : status === 'active' ? 'Assenza in corso' : 'In programma'}
            </p>
          )}
        </div>

        {status !== 'past' && !absence.approved && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => onEdit(absence)}
              className="p-2 bg-white border border-blue-100 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              aria-label="Modifica assenza"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(absence.id)}
              className="p-2 bg-white border border-red-100 text-red-600 hover:bg-red-50 rounded-xl transition-all"
              aria-label="Elimina assenza"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
