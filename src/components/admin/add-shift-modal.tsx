'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, ChevronRight, Calendar, User, Clock, ShieldCheck, Check, Info, Users, Plus } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn, getRoleName } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'

interface User {
  id: string
  username: string
  primaryRole: string
  availableRoles: string[]
  availabilities?: {
    dayOfWeek: number
    shiftType: string
    isAvailable: boolean
  }[]
}

interface AddShiftModalProps {
  weekStart: Date
  onClose: () => void
  onShiftAdded: () => void
  prefilledData?: {
    dayOfWeek?: number
    shiftType?: string
    role?: string
  } | null
}

export function AddShiftModal({ weekStart, onClose, onShiftAdded, prefilledData }: AddShiftModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [existingShifts, setExistingShifts] = useState<{ userId: string; role: string }[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedDay, setSelectedDay] = useState(0) // 0 = Monday (our system)
  const [selectedShiftType, setSelectedShiftType] = useState('PRANZO')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedStartTime, setSelectedStartTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()

  // ⭐ Ref per gestire le richieste in corso ed evitare race conditions
  const fetchControllerRef = useRef<AbortController | null>(null)

  const days = [
    { value: 0, label: 'Lunedì' },
    { value: 1, label: 'Martedì' },
    { value: 2, label: 'Mercoledì' },
    { value: 3, label: 'Giovedì' },
    { value: 4, label: 'Venerdì' },
    { value: 5, label: 'Sabato' },
    { value: 6, label: 'Domenica' }
  ]

  const shiftTypes = [
    { value: 'PRANZO', label: 'Pranzo (11:00-14:00)' },
    { value: 'CENA', label: 'Cena (17:00-21:00)' }
  ]

  // Orari di inizio disponibili in base al turno e ruolo selezionato
  const getAvailableStartTimes = (shiftType: string, role: string) => {
    if (shiftType === 'PRANZO') {
      if (role === 'SALA' || role === 'FATTORINO') {
        // SALA e FATTORINO: NO 11:00, iniziano da 11:30
        return [
          { value: '11:30', label: '11:30' },
          { value: '12:00', label: '12:00' }
        ]
      } else {
        // PIZZAIOLO e CUCINA: possono iniziare alle 11:00
        return [
          { value: '11:00', label: '11:00' },
          { value: '11:30', label: '11:30' },
          { value: '12:00', label: '12:00' }
        ]
      }
    } else { // CENA
      if (role === 'FATTORINO') {
        // FATTORINO: solo dalle 18:00, NO 19:30
        return [
          { value: '18:00', label: '18:00' },
          { value: '18:30', label: '18:30' },
          { value: '19:00', label: '19:00' }
        ]
      } else if (role === 'SALA') {
        // SALA: dalle 18:00, NO 19:00, NO 19:30
        return [
          { value: '18:00', label: '18:00' },
          { value: '18:30', label: '18:30' }
        ]
      } else {
        // PIZZAIOLO e CUCINA: possono iniziare alle 17:00
        return [
          { value: '17:00', label: '17:00' },
          { value: '17:30', label: '17:30' },
          { value: '18:00', label: '18:00' },
          { value: '18:30', label: '18:30' }
        ]
      }
    }
  }

  // ⭐ Funzione unificata per il caricamento dati
  const loadData = async (day: number, shiftType: string) => {
    // Annulla eventuali richieste precedenti
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort()
    }
    fetchControllerRef.current = new AbortController()
    const { signal } = fetchControllerRef.current

    try {
      console.log(`🚀 [Modal] Caricamento dati per Giorno ${day}, Turno ${shiftType}`)
      
      const weekStartStr = weekStart.toISOString()
      const timestamp = new Date().getTime()

      // Carica contemporaneamente utenti e turni esistenti
      const [usersRes, scheduleRes] = await Promise.all([
        fetch(`/api/admin/users/available?weekStart=${weekStartStr}&_t=${timestamp}`, { signal }),
        fetch(`/api/admin/schedule/${weekStartStr}?_t=${timestamp}`, { signal })
      ])

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData)
      }

      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json()
        if (scheduleData.shifts) {
          // ⭐ FILTRO CRITICO: Solo i turni che corrispondono ESATTAMENTE a giorno e turno selezionati
          const filtered = scheduleData.shifts
            .filter((s: any) => 
              s.dayOfWeek === day && 
              s.shiftType === shiftType
            )
            .map((s: any) => ({
              userId: s.userId,
              role: s.role
            }))
          
          setExistingShifts(filtered)
          console.log(`✅ [Modal] Trovati ${filtered.length} collaboratori già in turno per questo slot`)
        } else {
          setExistingShifts([])
        }
      } else if (scheduleRes.status === 404) {
        setExistingShifts([])
      }

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error loading modal data:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  // ⭐ Effetto principale: carica i dati al variare di qualsiasi parametro
  useEffect(() => {
    loadData(selectedDay, selectedShiftType)
    
    return () => {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort()
      }
    }
  }, [selectedDay, selectedShiftType, weekStart])

  useEffect(() => {
    // Imposta i valori precompilati se forniti
    if (prefilledData) {
      if (prefilledData.dayOfWeek !== undefined) {
        setSelectedDay(prefilledData.dayOfWeek)
      }
      if (prefilledData.shiftType) {
        setSelectedShiftType(prefilledData.shiftType)
      }
      if (prefilledData.role) {
        setSelectedRole(prefilledData.role)
      }
    }
  }, [prefilledData])

  useEffect(() => {
    // Reset role when user changes, solo se non abbiamo dati precompilati
    if (!prefilledData?.role) {
      setSelectedRole('')
    }
  }, [selectedUserId, prefilledData?.role])

  useEffect(() => {
    // Reset start time when shift type changes
    setSelectedStartTime('')
  }, [selectedShiftType])

  useEffect(() => {
    // Reset start time when role changes (because available times depend on role)
    setSelectedStartTime('')
  }, [selectedRole])

  const selectedUser = users.find(u => u.id === selectedUserId)
  const availableRoles = selectedUser?.availableRoles || []

  // Helper per controllare se un utente è disponibile
  const isUserAvailable = (user: User): boolean => {
    // Se non ci sono disponibilità caricate, assumiamo non disponibile per sicurezza
    if (!user.availabilities || user.availabilities.length === 0) return false
    
    const availability = user.availabilities.find(
      a => a.dayOfWeek === selectedDay && a.shiftType === selectedShiftType
    )
    return availability?.isAvailable || false
  }

  // Helper per controllare se un utente è già assegnato a questo turno
  const isUserAlreadyAssigned = (userId: string): boolean => {
    return existingShifts.some(shift => shift.userId === userId)
  }

  // ⭐ Ordina gli utenti per pertinenza
  const sortedUsers = [...users].sort((a, b) => {
    const assignedA = isUserAlreadyAssigned(a.id)
    const assignedB = isUserAlreadyAssigned(b.id)
    const availA = isUserAvailable(a)
    const availB = isUserAvailable(b)

    // 1. Già assegnati in fondo
    if (assignedA && !assignedB) return 1
    if (!assignedA && assignedB) return -1

    // 2. Disponibili prima degli indisponibili
    if (availA && !availB) return -1
    if (!availA && availB) return 1

    // 3. Ordine alfabetico come fallback
    return a.username.localeCompare(b.username)
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedUserId || !selectedRole || !selectedStartTime) {
      showToast('Completa tutti i campi obbligatori', 'error')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/admin/schedule/${weekStart.toISOString()}/add-shift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedUserId,
          dayOfWeek: selectedDay,
          shiftType: selectedShiftType,
          role: selectedRole,
          startTime: selectedStartTime
        })
      })

      const data = await response.json()

      if (response.ok) {
        showToast(data.message || 'Turno aggiunto con successo!', 'success')
        onShiftAdded()
        onClose()
      } else {
        showToast(data.error || 'Errore durante l\'aggiunta del turno', 'error')
      }
    } catch (error) {
      console.error('Error adding shift:', error)
      showToast('Errore durante l\'aggiunta del turno', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Caricamento..." maxWidth="md">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--pd-accent)] mb-4"></div>
          <p className="text-[var(--pd-muted)] font-bold  text-xs">Preparazione turni...</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Aggiungi Turno"
      subtitle="Inserimento manuale fuori algoritmo"
      headerIcon={<Plus className="h-6 w-6" />}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-8 pt-4">
        {/* Dipendente */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-[var(--pd-muted)]  px-1 flex items-center gap-2">
            <User className="h-3 w-3" /> Dipendente
          </label>
          <div className="relative group">
            <select
              required
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full pl-5 pr-12 py-4 bg-[var(--pd-surface-muted)] border-[var(--pd-border)] border-2 rounded-[var(--pd-radius)] text-sm font-semibold text-[var(--pd-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all appearance-none"
            >
              <option value="">Seleziona collaboratore...</option>
              {sortedUsers.map(user => {
                const alreadyAssigned = isUserAlreadyAssigned(user.id)
                const available = isUserAvailable(user)
                return (
                  <option key={user.id} value={user.id} disabled={alreadyAssigned}>
                    {user.username} ({getRoleName(user.primaryRole)}) 
                    {alreadyAssigned ? ' - Già assegnato' : available ? ' - Disponibile' : ' - Non disp.'}
                  </option>
                )
              })}
            </select>
            <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pd-muted)] rotate-90" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Giorno */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[var(--pd-muted)]  px-1 flex items-center gap-2">
              <Calendar className="h-3 w-3" /> Giorno
            </label>
            <div className="relative group">
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                className="w-full pl-5 pr-12 py-4 bg-[var(--pd-surface-muted)] border-[var(--pd-border)] border-2 rounded-[var(--pd-radius)] text-sm font-semibold text-[var(--pd-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all appearance-none"
              >
                {days.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pd-muted)] rotate-90" />
            </div>
          </div>

          {/* Turno */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[var(--pd-muted)]  px-1 flex items-center gap-2">
              <Clock className="h-3 w-3" /> Turno
            </label>
            <div className="relative group">
              <select
                value={selectedShiftType}
                onChange={(e) => setSelectedShiftType(e.target.value)}
                className="w-full pl-5 pr-12 py-4 bg-[var(--pd-surface-muted)] border-[var(--pd-border)] border-2 rounded-[var(--pd-radius)] text-sm font-semibold text-[var(--pd-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all appearance-none"
              >
                {shiftTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pd-muted)] rotate-90" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Ruolo */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[var(--pd-muted)]  px-1 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" /> Ruolo
            </label>
            <div className="relative group">
              <select
                required
                disabled={!selectedUserId}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full pl-5 pr-12 py-4 bg-[var(--pd-surface-muted)] border-[var(--pd-border)] border-2 rounded-[var(--pd-radius)] text-sm font-semibold text-[var(--pd-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all appearance-none disabled:opacity-50"
              >
                <option value="">Seleziona ruolo...</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{getRoleName(role)}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pd-muted)] rotate-90" />
            </div>
          </div>

          {/* Orario Inizio */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[var(--pd-muted)]  px-1 flex items-center gap-2">
              <Clock className="h-3 w-3" /> Orario Inizio
            </label>
            <div className="relative group">
              <select
                required
                disabled={!selectedRole}
                value={selectedStartTime}
                onChange={(e) => setSelectedStartTime(e.target.value)}
                className="w-full pl-5 pr-12 py-4 bg-[var(--pd-surface-muted)] border-[var(--pd-border)] border-2 rounded-[var(--pd-radius)] text-sm font-semibold text-[var(--pd-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all appearance-none disabled:opacity-50"
              >
                <option value="">Scegli orario...</option>
                {getAvailableStartTimes(selectedShiftType, selectedRole).map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pd-muted)] rotate-90" />
            </div>
          </div>
        </div>

        {/* Selected User Info Display */}
        {selectedUser && (
          <div className="bg-[var(--pd-accent-soft)] rounded-[var(--pd-radius)] p-5 border border-[var(--pd-border)] flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-12 rounded-full bg-[var(--pd-surface)] flex items-center justify-center text-[var(--pd-accent)] shadow-sm border border-[var(--pd-border)] font-semibold text-lg">
              {selectedUser.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[var(--pd-accent)] leading-none mb-1">Qualifiche Attive</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedUser.availableRoles.map(role => (
                  <span key={role} className="text-[9px] font-semibold uppercase px-2 py-0.5 bg-[var(--pd-accent-soft)] text-[var(--pd-accent-hover)] rounded-lg border border-[var(--pd-accent)]">
                    {getRoleName(role)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ⭐ Visual Staff Status List */}
        <div className="space-y-3 pt-4 border-t border-[var(--pd-border)]">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-semibold text-[var(--pd-muted)]  flex items-center gap-2">
              <Users className="h-3 w-3" /> Stato Squadra per questo Turno
            </label>
            <span className="text-[9px] font-bold text-[var(--pd-muted)] uppercase">
              {days.find(d => d.value === selectedDay)?.label} - {selectedShiftType}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
            {sortedUsers.map(user => {
              const assigned = isUserAlreadyAssigned(user.id)
              const available = isUserAvailable(user)
              const isSelected = selectedUserId === user.id

              return (
                <div 
                  key={user.id}
                  onClick={() => !assigned && setSelectedUserId(user.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                    assigned ? "bg-[var(--pd-surface-muted)] border-[var(--pd-border)] opacity-60 cursor-not-allowed" : 
                    isSelected ? "bg-[var(--pd-accent-soft)] border-[var(--pd-accent)] shadow-sm" : 
                    "bg-[var(--pd-surface)] border-[var(--pd-border)] hover:border-[var(--pd-border-strong)]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      assigned ? "bg-[var(--pd-accent)]" : available ? "bg-[var(--pd-success)] animate-pulse" : "bg-[var(--pd-danger)]"
                    )} />
                    <div>
                      <p className="text-xs font-semibold text-[var(--pd-text)] leading-none">{user.username}</p>
                      <p className="text-[9px] font-bold text-[var(--pd-muted)] uppercase mt-0.5">{getRoleName(user.primaryRole)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {assigned ? (
                      <span className="text-[8px] font-semibold text-[var(--pd-accent)] bg-[var(--pd-accent-soft)] px-1.5 py-0.5 rounded uppercase">In Turno</span>
                    ) : available ? (
                      <span className="text-[8px] font-semibold text-[var(--pd-success)] bg-[var(--pd-success-soft)] px-1.5 py-0.5 rounded uppercase">Disponibile</span>
                    ) : (
                      <span className="text-[8px] font-semibold text-[var(--pd-danger)] bg-[var(--pd-danger-soft)] px-1.5 py-0.5 rounded uppercase">No Disp.</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[9px] text-[var(--pd-muted)] italic px-1">
            <Info className="inline h-2.5 w-2.5 mb-0.5 mr-1" />
            Clicca su un collaboratore disponibile per selezionarlo rapidamente.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 text-xs font-semibold  text-[var(--pd-muted)] hover:bg-[var(--pd-surface-muted)] rounded-2xl transition-all"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedUserId || !selectedRole || !selectedStartTime}
            className="flex-[2] py-4 pd-btn-primary text-xs active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
          >
            {submitting ? 'Inserimento...' : 'Conferma Turno'}
          </button>
        </div>
      </form>
      <ToastContainer />
    </Modal>
  )
}
