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
}

interface AddShiftModalProps {
  weekStart: Date
  onClose: () => void
  onShiftAdded: () => void
}

export function AddShiftModal({ weekStart, onClose, onShiftAdded }: AddShiftModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedDay, setSelectedDay] = useState(1) // 1 = Monday
  const [selectedShiftType, setSelectedShiftType] = useState('PRANZO')
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()

  const days = [
    { value: 1, label: 'Lunedì' },
    { value: 2, label: 'Martedì' },
    { value: 3, label: 'Mercoledì' },
    { value: 4, label: 'Giovedì' },
    { value: 5, label: 'Venerdì' },
    { value: 6, label: 'Sabato' },
    { value: 0, label: 'Domenica' }
  ]

  const shiftTypes = [
    { value: 'PRANZO', label: 'Pranzo (11:30-14:00)' },
    { value: 'CENA', label: 'Cena (18:00-22:00)' }
  ]

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    // Reset role when user changes
    setSelectedRole('')
  }, [selectedUserId])

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

  const selectedUser = users.find(u => u.id === selectedUserId)
  const availableRoles = selectedUser?.availableRoles || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedUserId || !selectedRole) {
      showToast('Seleziona utente e ruolo', 'error')
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
          role: selectedRole
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
                ...users.map(user => ({
                  value: user.id,
                  label: `${user.username} (${getRoleName(user.primaryRole)})`
                }))
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
                disabled={!selectedUserId || !selectedRole}
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
