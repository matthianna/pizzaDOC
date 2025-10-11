'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, ChevronLeft, ChevronRight, Play, Download, Trash2, AlertTriangle, UserPlus, Car, Bike, UserMinus, Clock, X, BarChart3, Edit } from 'lucide-react'
import { getNextWeekStart, getWeekDays, formatDate, getDayOfWeek } from '@/lib/date-utils'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { Role, ShiftType, TransportType } from '@prisma/client'
import { AddShiftModal } from '@/components/admin/add-shift-modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

interface ScheduleShift {
  id: string
  userId: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  user: {
    id: string
    username: string
    primaryRole: Role
    primaryTransport: TransportType
    user_transports: { transport: TransportType }[]
  }
}

interface Schedule {
  id: string
  weekStart: string
  shifts: ScheduleShift[]
}

interface Gap {
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  required: number
  assigned: number
}

export default function AdminSchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(getNextWeekStart())
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [gaps, setGaps] = useState<Gap[]>([])
  const [shiftLimits, setShiftLimits] = useState<{ dayOfWeek: number; shiftType: string; role: string; minStaff: number; maxStaff: number }[]>([])
  const [missingAvailability, setMissingAvailability] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showAddShiftModal, setShowAddShiftModal] = useState(false)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [prefilledShiftData, setPrefilledShiftData] = useState<{
    dayOfWeek?: number
    shiftType?: ShiftType
    role?: Role
  } | null>(null)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<ScheduleShift | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const [removing, setRemoving] = useState(false)
  
  // Stati per modifica orari
  const [showTimeEditModal, setShowTimeEditModal] = useState(false)
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null)
  const [newStartTime, setNewStartTime] = useState('')
  const [, setNewEndTime] = useState('')
  const [updatingTime, setUpdatingTime] = useState(false)

  // Stati per modifica ruolo
  const [showRoleEditModal, setShowRoleEditModal] = useState(false)
  const [editingRoleShift, setEditingRoleShift] = useState<ScheduleShift | null>(null)
  const [newRole, setNewRole] = useState<Role | ''>('')
  const [updatingRole, setUpdatingRole] = useState(false)

  useEffect(() => {
    fetchSchedule()
    fetchShiftLimits()
    fetchMissingAvailability()
  }, [currentWeek])

  useEffect(() => {
    if (schedule && shiftLimits.length > 0) {
      calculateGaps()
    }
  }, [schedule, shiftLimits])

  const fetchSchedule = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/schedule/${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        setSchedule(data)
      } else if (response.status === 404) {
        // Piano non ancora generato - comportamento normale
        console.log(`📅 Nessun piano trovato per la settimana del ${currentWeek.toISOString().split('T')[0]} - clicca "Genera Piano" per crearlo`)
        setSchedule(null)
      }
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchShiftLimits = async () => {
    try {
      const response = await fetch('/api/admin/shift-limits')
      if (response.ok) {
        const data = await response.json()
        setShiftLimits(data)
      }
    } catch (error) {
      console.error('Error fetching shift limits:', error)
    }
  }

  const fetchMissingAvailability = async () => {
    try {
      const response = await fetch(`/api/admin/missing-availability?weekStart=${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        setMissingAvailability(data.missingUsers.sort())
      }
    } catch (error) {
      console.error('Error fetching missing availability:', error)
    }
  }

  const calculateGaps = () => {
    if (!schedule || shiftLimits.length === 0) {
      setGaps([])
      return
    }

    const calculatedGaps: Gap[] = []
    const roles: Role[] = ['CUCINA', 'FATTORINO', 'SALA']
    const shiftTypes: ShiftType[] = ['PRANZO', 'CENA']
    
    // Group shifts by day/shift/role
    const shiftGroups: Record<string, ScheduleShift[]> = {}
    schedule.shifts.forEach(shift => {
      const key = `${shift.dayOfWeek}-${shift.shiftType}-${shift.role}`
      if (!shiftGroups[key]) {
        shiftGroups[key] = []
      }
      shiftGroups[key].push(shift)
    })

    // Calculate gaps for each day/shift/role combination
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      for (const shiftType of shiftTypes) {
        for (const role of roles) {
          const limit = shiftLimits.find(l => 
            l.dayOfWeek === dayOfWeek && 
            l.shiftType === shiftType && 
            l.role === role
          )

          if (limit && limit.minStaff > 0) {
            const key = `${dayOfWeek}-${shiftType}-${role}`
            const assigned = shiftGroups[key] ? shiftGroups[key].length : 0
            
            if (assigned < limit.minStaff) {
              calculatedGaps.push({
                dayOfWeek,
                shiftType,
                role,
                required: limit.minStaff,
                assigned
              })
            }
          }
        }
      }
    }

  setGaps(calculatedGaps)
}

  const generateSchedule = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/admin/schedule/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          weekStart: currentWeek.toISOString()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setGaps(data.gaps || [])
        await fetchSchedule()
        alert(`Piano generato con successo! ${data.shiftsGenerated} turni assegnati.`)
      } else {
        alert('Errore durante la generazione del piano')
      }
    } catch (error) {
      console.error('Error generating schedule:', error)
      alert('Errore durante la generazione del piano')
    } finally {
      setGenerating(false)
    }
  }

  const deleteSchedule = async () => {
    try {
      const response = await fetch(`/api/admin/schedule/${currentWeek.toISOString()}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSchedule(null)
        setGaps([])
        alert('Piano eliminato con successo')
      } else {
        alert('Errore durante l\'eliminazione del piano')
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('Errore durante l\'eliminazione del piano')
    }
  }

  const exportToPDF = async () => {
    try {
      // Apri l'HTML in una nuova finestra
      const response = await fetch(`/api/admin/schedule/${currentWeek.toISOString()}/export-pdf`)
      if (response.ok) {
        const html = await response.text()
        const newWindow = window.open('', '_blank')
        if (newWindow) {
          newWindow.document.write(html)
          newWindow.document.close()
          
          // Aspetta che il contenuto sia caricato e poi stampa
          setTimeout(() => {
            newWindow.print()
          }, 1000)
        }
      } else {
        alert('Errore durante l\'esportazione PDF')
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Errore durante l\'esportazione PDF')
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeek(newWeek)
  }

  const handleRemoveShift = (shift: ScheduleShift) => {
    setSelectedShift(shift)
    setRemoveReason('')
    setShowRemoveModal(true)
  }

  const confirmRemoveShift = async () => {
    if (!selectedShift) return

    setRemoving(true)
    try {
      const response = await fetch('/api/admin/schedule/remove-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shiftId: selectedShift.id,
          reason: removeReason,
          createSubstitution: false
        })
      })

      if (response.ok) {
        const result = await response.json()
        setShowRemoveModal(false)
        await fetchSchedule()
        
        alert(`Turno di ${result.username} rimosso definitivamente.`)
      } else {
        const error = await response.json()
        alert(error.error || 'Errore nella rimozione')
      }
    } catch (error) {
      console.error('Error removing shift:', error)
      alert('Errore nella rimozione del turno')
    } finally {
      setRemoving(false)
    }
  }

  const handleEditShiftTime = (shift: ScheduleShift) => {
    setEditingShift(shift)
    setNewStartTime(shift.startTime)
    setNewEndTime(shift.endTime)
    setShowTimeEditModal(true)
  }

  const confirmTimeUpdate = async () => {
    if (!editingShift) return

    setUpdatingTime(true)
    try {
      const endTime = editingShift.shiftType === 'PRANZO' ? '14:00' : '22:00'
      const response = await fetch(`/api/admin/shifts/${editingShift.id}/times`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime: newStartTime,
          endTime: endTime
        })
      })

      if (response.ok) {
        setShowTimeEditModal(false)
        setEditingShift(null)
        fetchSchedule() // Ricarica il piano
      } else {
        const error = await response.json()
        alert(error.error || 'Errore nell\'aggiornamento degli orari')
      }
    } catch (error) {
      console.error('Error updating shift times:', error)
      alert('Errore nell\'aggiornamento degli orari')
    } finally {
      setUpdatingTime(false)
    }
  }

  const handleEditRole = (shift: ScheduleShift) => {
    setEditingRoleShift(shift)
    setNewRole(shift.role)
    setShowRoleEditModal(true)
  }

  const confirmRoleUpdate = async () => {
    if (!editingRoleShift || !newRole) return

    setUpdatingRole(true)
    try {
      const response = await fetch(`/api/admin/shifts/${editingRoleShift.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: newRole
        })
      })

      if (response.ok) {
        setShowRoleEditModal(false)
        setEditingRoleShift(null)
        fetchSchedule() // Ricarica il piano
      } else {
        const error = await response.json()
        alert(error.error || 'Errore nell\'aggiornamento del ruolo')
      }
    } catch (error) {
      console.error('Error updating shift role:', error)
      alert('Errore nell\'aggiornamento del ruolo')
    } finally {
      setUpdatingRole(false)
    }
  }

  const handleQuickAdd = (dayOfWeek: number, shiftType: ShiftType, role: Role) => {
    // Imposta i parametri precompilati
    setPrefilledShiftData({
      dayOfWeek,
      shiftType,
      role
    })
    // Apri il modal di aggiunta turno
    setShowAddShiftModal(true)
  }

  const groupShiftsByDayAndShift = () => {
    if (!schedule) return {}
    
    const groups: Record<string, ScheduleShift[]> = {}
    
    schedule.shifts.forEach(shift => {
      const key = `${shift.dayOfWeek}-${shift.shiftType}`
      if (!groups[key]) groups[key] = []
      groups[key].push(shift)
    })
    
    return groups
  }

  const weekDays = getWeekDays(currentWeek)
  const shiftGroups = groupShiftsByDayAndShift()

  return (
    <MainLayout adminOnly>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-8 w-8 mr-3 text-orange-600" />
              Piano di Lavoro
            </h1>
            <p className="text-gray-800 mt-1">
              Genera e gestisci il piano settimanale dei turni
            </p>
          </div>
          <div className="flex space-x-3">
            {schedule && (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina Piano
                </button>
                <button
                  onClick={exportToPDF}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Esporta PDF
                </button>
              </>
            )}
            <button
              onClick={() => setShowGenerateConfirm(true)}
              disabled={generating}
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 flex items-center disabled:opacity-50"
            >
              <Play className="h-4 w-4 mr-2" />
              {generating ? 'Generando...' : 'Genera Piano'}
            </button>
            <button
              onClick={() => {
                setPrefilledShiftData(null)
                setShowAddShiftModal(true)
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Aggiungi Turno
            </button>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateWeek('prev')}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Settimana precedente
            </button>
            
            <div className="text-center">
              <h2 className="text-lg font-bold text-2xl font-bold text-gray-900">
                Settimana dal {formatDate(weekDays[0])} al {formatDate(weekDays[6])}
              </h2>
            </div>
            
            <button
              onClick={() => navigateWeek('next')}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800"
            >
              Settimana successiva
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>

        {/* Availability Status */}
        {missingAvailability.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-amber-800">
                  Disponibilità Mancanti
                </h3>
                <div className="mt-2 text-sm text-amber-700">
                  <p className="mb-2">
                    I seguenti dipendenti non hanno ancora inserito la loro disponibilità per questa settimana:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {missingAvailability.map((username, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300"
                      >
                        {username}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-amber-600">
                    💡 Suggerimento: La generazione automatica produrrà risultati migliori quando tutti avranno inserito le loro disponibilità.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-800">
                  ✅ Tutte le disponibilità sono state inserite
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  Tutti i dipendenti hanno inserito la loro disponibilità per questa settimana. Puoi procedere con la generazione automatica del piano.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Coverage Report */}
        {schedule && shiftLimits.length > 0 && (
          <CoverageReport 
            schedule={schedule} 
            shiftLimits={shiftLimits}
            currentWeek={currentWeek}
          />
        )}

        {/* Schedule Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : schedule ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Giorno
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pranzo (11:30-14:00)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cena (18:00-22:00)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {weekDays.map((day, index) => {
                    const dayOfWeek = getDayOfWeek(day)
                    const pranzoCrew = shiftGroups[`${dayOfWeek}-PRANZO`] || []
                    const cenaCrew = shiftGroups[`${dayOfWeek}-CENA`] || []
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {getDayName(dayOfWeek)}
                            </div>
                            <div className="text-sm text-gray-700">
                              {formatDate(day)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <ShiftCrew 
                            shifts={pranzoCrew} 
                            dayOfWeek={dayOfWeek}
                            shiftType="PRANZO"
                            gaps={gaps}
                            shiftLimits={shiftLimits}
                            onRemoveShift={handleRemoveShift}
                            onEditTime={handleEditShiftTime}
                            onEditRole={handleEditRole}
                            onQuickAdd={handleQuickAdd}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <ShiftCrew 
                            shifts={cenaCrew} 
                            dayOfWeek={dayOfWeek}
                            shiftType="CENA"
                            gaps={gaps}
                            shiftLimits={shiftLimits}
                            onRemoveShift={handleRemoveShift}
                            onEditTime={handleEditShiftTime}
                            onEditRole={handleEditRole}
                            onQuickAdd={handleQuickAdd}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700 mb-4">Nessun piano generato per questa settimana</p>
              <button
                onClick={() => setShowGenerateConfirm(true)}
                disabled={generating}
                className="bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                {generating ? 'Generando...' : 'Genera Piano Automatico'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Shift Modal */}
      {showAddShiftModal && (
        <AddShiftModal
          weekStart={currentWeek}
          prefilledData={prefilledShiftData}
          onClose={() => {
            setShowAddShiftModal(false)
            setPrefilledShiftData(null)
          }}
          onShiftAdded={() => {
            setShowAddShiftModal(false)
            setPrefilledShiftData(null)
            fetchSchedule() // Refresh the schedule
          }}
        />
      )}

      {/* Remove Shift Modal */}
      {showRemoveModal && selectedShift && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Rimuovi dal Turno
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRemoveModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* User Info */}
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-medium text-red-900 text-sm mb-2">
                    Stai per rimuovere {selectedShift.user.username} dal turno:
                  </h4>
                  <div className="space-y-1 text-sm text-red-800">
                    <p><strong>Giorno:</strong> {getDayName(selectedShift.dayOfWeek)}</p>
                    <p><strong>Turno:</strong> {getShiftTypeName(selectedShift.shiftType)}</p>
                    <p><strong>Ruolo:</strong> {getRoleName(selectedShift.role)}</p>
                    <p><strong>Orario:</strong> {selectedShift.startTime} - {selectedShift.endTime}</p>
                  </div>
                </div>
                
                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo (opzionale)
                  </label>
                  <textarea
                    value={removeReason}
                    onChange={(e) => setRemoveReason(e.target.value)}
                    rows={3}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 bg-white shadow-sm hover:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
                    placeholder="Motivo della rimozione..."
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowRemoveModal(false)}
                  >
                    Annulla
                  </Button>
                  <Button
                    onClick={confirmRemoveShift}
                    disabled={removing}
                    isLoading={removing}
                    className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                  >
                    Conferma Rimozione
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifica Orari */}
      {showTimeEditModal && editingShift && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Modifica Orari Turno
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTimeEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* User Info */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 text-sm mb-2">
                    Modificando gli orari per {editingShift.user.username}:
                  </h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p><strong>Giorno:</strong> {getDayName(editingShift.dayOfWeek)}</p>
                    <p><strong>Turno:</strong> {getShiftTypeName(editingShift.shiftType)}</p>
                    <p><strong>Ruolo:</strong> {getRoleName(editingShift.role)}</p>
                  </div>
                </div>

                {/* Start Time Selection */}
                <Select
                  label="Orario Inizio"
                  options={[
                    { value: '', label: 'Seleziona orario' },
                    ...(editingShift?.shiftType === 'PRANZO' ? [
                      { value: '11:00', label: '11:00' },
                      { value: '11:30', label: '11:30' },
                      { value: '12:00', label: '12:00' }
                    ] : [
                      { value: '17:00', label: '17:00' },
                      { value: '17:30', label: '17:30' },
                      { value: '18:00', label: '18:00' },
                      { value: '18:30', label: '18:30' },
                      { value: '19:00', label: '19:00' }
                    ])
                  ]}
                  value={newStartTime}
                  onChange={(value) => setNewStartTime(value as string)}
                />

                <p className="text-sm text-gray-600">
                  💡 Gli orari di fine sono fissi per tutti i turni
                </p>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTimeEditModal(false)}
                  >
                    Annulla
                  </Button>
                  <Button
                    onClick={confirmTimeUpdate}
                    disabled={!newStartTime || updatingTime}
                    isLoading={updatingTime}
                  >
                    Aggiorna Orari
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifica Ruolo */}
      {showRoleEditModal && editingRoleShift && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Modifica Ruolo Turno
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRoleEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* User Info */}
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 text-sm mb-2">
                    Modificando il ruolo per {editingRoleShift.user.username}:
                  </h4>
                  <div className="space-y-1 text-sm text-purple-800">
                    <p><strong>Giorno:</strong> {getDayName(editingRoleShift.dayOfWeek)}</p>
                    <p><strong>Turno:</strong> {getShiftTypeName(editingRoleShift.shiftType)}</p>
                    <p><strong>Ruolo attuale:</strong> {getRoleName(editingRoleShift.role)}</p>
                    <p><strong>Ruolo principale:</strong> {getRoleName(editingRoleShift.user.primaryRole)}</p>
                  </div>
                </div>

                {/* Role Selection */}
                <Select
                  label="Nuovo Ruolo"
                  options={[
                    { value: '', label: 'Seleziona ruolo' },
                    { value: 'FATTORINO', label: getRoleName('FATTORINO') },
                    { value: 'CUCINA', label: getRoleName('CUCINA') },
                    { value: 'SALA', label: getRoleName('SALA') },
                    { value: 'PIZZAIOLO', label: getRoleName('PIZZAIOLO') }
                  ]}
                  value={newRole}
                  onChange={(value) => setNewRole(value as Role)}
                />

                <p className="text-sm text-gray-600">
                  💡 Verifica che l'utente possa svolgere questo ruolo
                </p>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowRoleEditModal(false)}
                  >
                    Annulla
                  </Button>
                  <Button
                    onClick={confirmRoleUpdate}
                    disabled={!newRole || updatingRole}
                    isLoading={updatingRole}
                  >
                    Aggiorna Ruolo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Schedule Confirmation Modal */}
      <ConfirmationModal
        isOpen={showGenerateConfirm}
        onClose={() => setShowGenerateConfirm(false)}
        onConfirm={async () => {
          await generateSchedule()
          setShowGenerateConfirm(false)
        }}
        title="Genera Piano Settimanale"
        description="Stai per generare un nuovo piano settimanale. Se esiste già un piano per questa settimana, verrà sostituito. Questa azione è irreversibile."
        confirmPhrase="GENERA PIANO"
        confirmButtonText="Genera Piano"
        isDangerous={true}
        metadata={
          <div className="text-sm space-y-1">
            <p><strong>Settimana:</strong> {formatDate(currentWeek)} - {formatDate(new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000))}</p>
            <p><strong>Modalità:</strong> Algoritmo massima copertura</p>
            {missingAvailability.length > 0 && (
              <p className="text-amber-600"><strong>⚠️ Attenzione:</strong> {missingAvailability.length} utenti senza disponibilità</p>
            )}
          </div>
        }
      />

      {/* Delete Schedule Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          await deleteSchedule()
          setShowDeleteConfirm(false)
        }}
        title="Elimina Piano Settimanale"
        description="Stai per eliminare completamente il piano di questa settimana. Tutti i turni assegnati verranno rimossi. Questa azione NON può essere annullata."
        confirmPhrase="ELIMINA PIANO"
        confirmButtonText="Elimina Piano"
        isDangerous={true}
        metadata={
          <div className="text-sm space-y-1">
            <p><strong>Settimana:</strong> {formatDate(currentWeek)} - {formatDate(new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000))}</p>
            {schedule && <p><strong>Turni da eliminare:</strong> {schedule.shifts.length}</p>}
          </div>
        }
      />
    </MainLayout>
  )
}

// Helper function for transport icons
function getTransportIcon(user: ScheduleShift['user'], role: Role) {
  // Only show transport icons for delivery roles
  if (role !== 'FATTORINO') {
    return null
  }

  const primaryTransport = user.primaryTransport
  
  switch (primaryTransport) {
    case 'AUTO':
      return <Car className="h-3 w-3 text-blue-600" />
    case 'SCOOTER':
      return <Bike className="h-3 w-3 text-green-600" />
    default:
      return null
  }
}

function ShiftCrew({ 
  shifts, 
  dayOfWeek, 
  shiftType, 
  gaps, 
  shiftLimits,
  onRemoveShift,
  onEditTime,
  onEditRole,
  onQuickAdd
}: { 
  shifts: ScheduleShift[]
  dayOfWeek: number
  shiftType: ShiftType
  gaps: Gap[]
  shiftLimits: { dayOfWeek: number; shiftType: string; role: string; minStaff: number; maxStaff: number }[]
  onRemoveShift?: (shift: ScheduleShift) => void
  onEditTime?: (shift: ScheduleShift) => void
  onEditRole?: (shift: ScheduleShift) => void
  onQuickAdd?: (dayOfWeek: number, shiftType: ShiftType, role: Role) => void
}) {
  // Group by role
  const byRole = shifts.reduce((acc, shift) => {
    if (!acc[shift.role]) acc[shift.role] = []
    acc[shift.role].push(shift)
    return acc
  }, {} as Record<Role, ScheduleShift[]>)

  // Get all roles that should be displayed (configured + assigned)
  const allRoles = new Set<Role>()
  
  // Add roles from shift limits
  shiftLimits.forEach(limit => {
    if (limit.dayOfWeek === dayOfWeek && limit.shiftType === shiftType && limit.minStaff > 0) {
      allRoles.add(limit.role as Role)
    }
  })
  
  // Add roles from assigned shifts
  shifts.forEach(shift => allRoles.add(shift.role))

  if (allRoles.size === 0) {
    return <span className="text-gray-400 text-sm">Nessuno assegnato</span>
  }

  return (
    <div className="space-y-2">
      {Array.from(allRoles).map((role) => {
        const roleShifts = byRole[role] || []
        const limit = shiftLimits.find(l => 
          l.dayOfWeek === dayOfWeek && 
          l.shiftType === shiftType && 
          l.role === role
        )
        const gap = gaps.find(g => 
          g.dayOfWeek === dayOfWeek && 
          g.shiftType === shiftType && 
          g.role === role
        )
        
        const required = limit?.minStaff || 0
        const assigned = roleShifts.length
        const missing = Math.max(0, required - assigned)

        return (
          <div key={role}>
            <div className="flex items-center justify-between mb-1 group/role">
              <div className="flex items-center gap-2">
                <div className="text-xs font-medium text-gray-700">
                  {getRoleName(role)} ({assigned}/{required})
                </div>
                {onQuickAdd && (
                  <button
                    onClick={() => onQuickAdd(dayOfWeek, shiftType, role)}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-600 text-white hover:bg-orange-700 transition-all opacity-0 group-hover/role:opacity-100"
                    title={`Aggiungi ${getRoleName(role)}`}
                  >
                    <UserPlus className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              {missing > 0 && (
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                  -{missing}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {roleShifts.map((shift) => {
                const transportIcon = getTransportIcon(shift.user, shift.role)
                return (
                  <div
                    key={shift.id}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 group relative"
                  >
                    <span className="flex items-center gap-1">
                      {shift.user.username}
                      {transportIcon}
                      <span className="text-xs text-orange-600 ml-1">
                        {shift.startTime}
                      </span>
                    </span>
                    <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onEditTime && (
                        <button
                          onClick={() => onEditTime(shift)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Modifica orari"
                        >
                          <Clock className="h-3 w-3" />
                        </button>
                      )}
                      {onEditRole && (
                        <button
                          onClick={() => onEditRole(shift)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Modifica ruolo"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      )}
                      {onRemoveShift && (
                        <button
                          onClick={() => onRemoveShift(shift)}
                          className="text-red-600 hover:text-red-800"
                          title="Rimuovi dal turno"
                        >
                          <UserMinus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {missing > 0 && (
                <div className="inline-flex items-center gap-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600 border border-red-200 border-dashed">
                    Mancano {missing}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CoverageReport({ 
  schedule, 
  shiftLimits, 
  currentWeek 
}: { 
  schedule: Schedule
  shiftLimits: { dayOfWeek: number; shiftType: string; role: string; minStaff: number; maxStaff: number }[]
  currentWeek: Date
}) {
  const [coverageData, setCoverageData] = useState<{
    userStats: Array<{
      userId: string
      username: string
      primaryRole: string | null
      availabilitiesEntered: number
      shiftsAssigned: number
      assignmentPercentage: number
    }>
    global: {
      totalAvailabilities: number
      totalAssignments: number
      assignmentPercentage: number
    }
  } | null>(null)

  useEffect(() => {
    fetchCoverageData()
  }, [schedule, currentWeek])

  const fetchCoverageData = async () => {
    try {
      const response = await fetch(`/api/admin/schedule/coverage-stats?weekStart=${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        setCoverageData(data)
      }
    } catch (error) {
      console.error('Error fetching coverage stats:', error)
    }
  }

  if (!coverageData) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center mb-4">
        <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-base font-semibold text-blue-800">
          Resoconto Assegnamento Turni per Persona
        </h3>
      </div>
      
      {/* Global Stats */}
      <div className="bg-white rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {coverageData.global.assignmentPercentage}%
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {coverageData.global.totalAssignments} turni assegnati su {coverageData.global.totalAvailabilities} disponibilità inserite
          </div>
        </div>
      </div>

      {/* User Stats Table */}
      <div className="bg-white rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Dipendente
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Ruolo
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Disponibilità
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Assegnati
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  % Assegnamento
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {coverageData.userStats.map((user) => (
                <tr key={user.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.username}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className="text-xs font-medium text-gray-600">
                      {user.primaryRole || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className="text-sm font-semibold text-gray-900">
                      {user.availabilitiesEntered}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className="text-sm font-semibold text-gray-900">
                      {user.shiftsAssigned}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            user.assignmentPercentage >= 80 ? 'bg-green-500' :
                            user.assignmentPercentage >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, user.assignmentPercentage)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold ${
                        user.assignmentPercentage >= 80 ? 'text-green-600' :
                        user.assignmentPercentage >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {user.assignmentPercentage}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
