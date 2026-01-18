'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn, getRoleName } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { ChevronRight, Calendar, User, Clock, ShieldCheck, Check, Info, Users } from 'lucide-react'

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
    { value: 'CENA', label: 'Cena (17:00-22:00)' }
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

  // ⭐ PRIMO CARICAMENTO: esegue subito all'apertura del modal
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      console.log('🚀 [Modal] Apertura modal - caricamento iniziale')
      await Promise.all([
        fetchUsers(),
        fetchExistingShifts()
      ])
      setLoading(false)
      console.log('✅ [Modal] Caricamento iniziale completato')
    }
    loadInitialData()
  }, []) // Array vuoto = solo al mount

  // ⭐ Ricarica quando cambiano giorno, turno o settimana
  useEffect(() => {
    const reloadData = async () => {
      console.log('🔄 [Modal] Cambio parametri - ricaricamento dati')
      await Promise.all([
        fetchExistingShifts(),
        fetchUsers()
      ])
      console.log('✅ [Modal] Ricaricamento completato')
    }
    reloadData()
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

  const fetchUsers = async () => {
    try {
      // ⭐ PASSA weekStart per ottenere disponibilità della settimana specifica!
      const weekStartStr = weekStart.toISOString()
      // ⚠️ Aggiungi timestamp per forzare bypass cache browser
      const timestamp = new Date().getTime()
      const response = await fetch(
        `/api/admin/users/available?weekStart=${weekStartStr}&_t=${timestamp}`,
        {
          cache: 'no-store', // ⚠️ Disabilita cache browser
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ [Modal] Utenti caricati: ${data.length}`)
        setUsers(data)
      } else {
        showToast('Errore nel caricamento utenti', 'error')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      showToast('Errore nel caricamento utenti', 'error')
    }
  }

  const fetchExistingShifts = async () => {
    try {
      const weekStartStr = weekStart.toISOString()
      // ⚠️ Aggiungi timestamp per forzare bypass cache browser
      const timestamp = new Date().getTime()
      const response = await fetch(
        `/api/admin/schedule/${weekStartStr}?_t=${timestamp}`,
        {
          cache: 'no-store', // ⚠️ Disabilita cache browser
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        // L'API restituisce direttamente l'oggetto schedule con shifts
        if (data.shifts) {
          // Filtra i turni per il giorno e turno selezionati
          const filtered = data.shifts
            .filter((shift: any) => 
              shift.dayOfWeek === selectedDay && 
              shift.shiftType === selectedShiftType
            )
            .map((shift: any) => ({
              userId: shift.userId,
              role: shift.role
            }))
          setExistingShifts(filtered)
          console.log(`🔍 [Modal] Turni esistenti caricati per giorno ${selectedDay}, turno ${selectedShiftType}:`, filtered.length)
        } else {
          setExistingShifts([])
        }
      } else if (response.status === 404) {
        // Nessun piano ancora generato per questa settimana
        setExistingShifts([])
        console.log('📅 [Modal] Nessun piano ancora generato per questa settimana')
      }
    } catch (error) {
      console.error('Error fetching existing shifts:', error)
      setExistingShifts([])
    }
  }

  const selectedUser = users.find(u => u.id === selectedUserId)
  const availableRoles = selectedUser?.availableRoles || []

  // Helper per controllare se un utente è disponibile
  const isUserAvailable = (user: User): boolean => {
    const availability = user.availabilities?.find(
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Preparazione turni...</p>
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
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <User className="h-3 w-3" /> Dipendente
          </label>
          <div className="relative group">
            <select
              required
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full pl-5 pr-12 py-4 bg-gray-50 border-gray-100 border-2 rounded-[1.5rem] text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all appearance-none"
            >
              <option value="">Seleziona collaboratore...</option>
              {sortedUsers.map(user => {
                const alreadyAssigned = isUserAlreadyAssigned(user.id)
                const available = isUserAvailable(user)
                return (
                  <option key={user.id} value={user.id} disabled={alreadyAssigned}>
                    {available ? '✅ ' : alreadyAssigned ? '🔒 ' : '⛔ '}
                    {user.username} ({getRoleName(user.primaryRole)}) 
                    {alreadyAssigned ? ' - Già assegnato' : available ? ' - Disponibile' : ' - Non disp.'}
                  </option>
                )
              })}
            </select>
            <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Giorno */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Calendar className="h-3 w-3" /> Giorno
            </label>
            <div className="relative group">
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                className="w-full pl-5 pr-12 py-4 bg-gray-50 border-gray-100 border-2 rounded-[1.5rem] text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all appearance-none"
              >
                {days.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* Turno */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Clock className="h-3 w-3" /> Turno
            </label>
            <div className="relative group">
              <select
                value={selectedShiftType}
                onChange={(e) => setSelectedShiftType(e.target.value)}
                className="w-full pl-5 pr-12 py-4 bg-gray-50 border-gray-100 border-2 rounded-[1.5rem] text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all appearance-none"
              >
                {shiftTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Ruolo */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" /> Ruolo
            </label>
            <div className="relative group">
              <select
                required
                disabled={!selectedUserId}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full pl-5 pr-12 py-4 bg-gray-50 border-gray-100 border-2 rounded-[1.5rem] text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all appearance-none disabled:opacity-50"
              >
                <option value="">Seleziona ruolo...</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{getRoleName(role)}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* Orario Inizio */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Clock className="h-3 w-3" /> Orario Inizio
            </label>
            <div className="relative group">
              <select
                required
                disabled={!selectedRole}
                value={selectedStartTime}
                onChange={(e) => setSelectedStartTime(e.target.value)}
                className="w-full pl-5 pr-12 py-4 bg-gray-50 border-gray-100 border-2 rounded-[1.5rem] text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all appearance-none disabled:opacity-50"
              >
                <option value="">Scegli orario...</option>
                {getAvailableStartTimes(selectedShiftType, selectedRole).map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90" />
            </div>
          </div>
        </div>

        {/* Selected User Info Display */}
        {selectedUser && (
          <div className="bg-orange-50 rounded-[1.5rem] p-5 border border-orange-100 flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-orange-600 shadow-sm border border-orange-100 font-black text-lg">
              {selectedUser.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">Qualifiche Attive</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedUser.availableRoles.map(role => (
                  <span key={role} className="text-[9px] font-black uppercase px-2 py-0.5 bg-orange-100 text-orange-700 rounded-lg border border-orange-200">
                    {getRoleName(role)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ⭐ Visual Staff Status List */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Users className="h-3 w-3" /> Stato Squadra per questo Turno
            </label>
            <span className="text-[9px] font-bold text-gray-400 uppercase">
              {days.find(d => d.value === selectedDay)?.label} - {selectedShiftType}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
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
                    assigned ? "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed" : 
                    isSelected ? "bg-orange-50 border-orange-500 shadow-sm" : 
                    "bg-white border-gray-100 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      assigned ? "bg-blue-500" : available ? "bg-green-500 animate-pulse" : "bg-red-400"
                    )} />
                    <div>
                      <p className="text-xs font-black text-gray-900 leading-none">{user.username}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{getRoleName(user.primaryRole)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {assigned ? (
                      <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">In Turno</span>
                    ) : available ? (
                      <span className="text-[8px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase">Disponibile</span>
                    ) : (
                      <span className="text-[8px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded uppercase">No Disp.</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[9px] text-gray-400 italic px-1">
            <Info className="inline h-2.5 w-2.5 mb-0.5 mr-1" />
            Clicca su un collaboratore disponibile per selezionarlo rapidamente.
          </p>
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
            disabled={submitting || !selectedUserId || !selectedRole || !selectedStartTime}
            className="flex-[2] py-4 bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
          >
            {submitting ? 'Inserimento...' : 'Conferma Turno'}
          </button>
        </div>
      </form>
      <ToastContainer />
    </Modal>
  )
}
