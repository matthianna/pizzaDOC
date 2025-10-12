'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getRoleName } from '@/lib/utils'

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

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    // Carica i turni esistenti quando cambiano giorno o turno
    fetchExistingShifts()
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
      const response = await fetch('/api/admin/users/available')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      } else {
        showToast('Errore nel caricamento utenti', 'error')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      showToast('Errore nel caricamento utenti', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingShifts = async () => {
    try {
      const weekStartStr = weekStart.toISOString().split('T')[0]
      const response = await fetch(`/api/admin/schedule/${weekStartStr}`)
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
          console.log(`🔍 Turni esistenti caricati per giorno ${selectedDay}, turno ${selectedShiftType}:`, filtered.length)
        } else {
          setExistingShifts([])
        }
      } else if (response.status === 404) {
        // Nessun piano ancora generato per questa settimana
        setExistingShifts([])
        console.log('📅 Nessun piano ancora generato per questa settimana')
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
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-md w-full p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Aggiungi Turno Manualmente
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
            {/* User Selection */}
            <Select
              label="Dipendente"
              options={[
                { value: '', label: 'Seleziona un dipendente' },
                ...users.map(user => {
                  const alreadyAssigned = isUserAlreadyAssigned(user.id)
                  const available = isUserAvailable(user)
                  
                  let statusIcon = ''
                  let statusText = ''
                  
                  if (alreadyAssigned) {
                    statusIcon = ' 🔒'
                    statusText = ' Già assegnato'
                  } else if (available) {
                    statusIcon = ' ✅'
                    statusText = ' Disponibile'
                  } else {
                    statusIcon = ' ⛔'
                    statusText = ' Non disponibile'
                  }
                  
                  return {
                    value: user.id,
                    label: `${user.username} (${getRoleName(user.primaryRole)})${statusIcon}${statusText}`,
                    disabled: alreadyAssigned
                  }
                })
              ]}
              value={selectedUserId}
              onChange={(value) => setSelectedUserId(value as string)}
            />

            {/* Day Selection */}
            <Select
              label="Giorno"
              options={days}
              value={selectedDay}
              onChange={(value) => setSelectedDay(value as number)}
            />

            {/* Shift Type Selection */}
            <Select
              label="Turno"
              options={shiftTypes}
              value={selectedShiftType}
              onChange={(value) => setSelectedShiftType(value as string)}
            />

            {/* Role Selection */}
            <Select
              label="Ruolo"
              options={[
                { value: '', label: 'Seleziona un ruolo' },
                ...availableRoles.map(role => ({
                  value: role,
                  label: getRoleName(role)
                }))
              ]}
              value={selectedRole}
              onChange={(value) => setSelectedRole(value as string)}
              disabled={!selectedUserId}
            />

            {/* Start Time Selection */}
            <Select
              label="Orario Inizio"
              options={[
                { value: '', label: 'Seleziona orario di inizio' },
                ...getAvailableStartTimes(selectedShiftType, selectedRole)
              ]}
              value={selectedStartTime}
              onChange={(value) => setSelectedStartTime(value as string)}
              disabled={!selectedRole}
            />

            {/* Selected User Info */}
            {selectedUser && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-medium text-blue-900 text-sm">Ruoli disponibili per {selectedUser.username}:</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedUser.availableRoles.map(role => (
                    <span
                      key={role}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        role === selectedUser.primaryRole
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {getRoleName(role)}
                      {role === selectedUser.primaryRole && <span className="ml-1">★</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Buttons */}
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
                disabled={!selectedUserId || !selectedRole || !selectedStartTime}
                isLoading={submitting}
              >
                Aggiungi Turno
              </Button>
            </div>
          </form>
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
