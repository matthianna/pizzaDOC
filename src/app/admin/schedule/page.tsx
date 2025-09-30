'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, ChevronLeft, ChevronRight, Play, Download, Trash2, AlertTriangle, UserPlus, Car, Bike, UserMinus, Clock, X, BarChart3, Users } from 'lucide-react'
import { getNextWeekStart, getWeekDays, formatDate, getDayOfWeek } from '@/lib/date-utils'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { Role, ShiftType, TransportType } from '@prisma/client'
import { AddShiftModal } from '@/components/admin/add-shift-modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

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
    userTransports: { transport: TransportType }[]
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
        setMissingAvailability(data.missingUsers)
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
    const roles: Role[] = ['CUCINA', 'FATTORINO', 'SALA', 'PIZZAIOLO']
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
    // 0=Monday, 1=Tuesday, ..., 6=Sunday
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
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
    if (!confirm('Sei sicuro di voler eliminare il piano di questa settimana?')) return

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
                  onClick={deleteSchedule}
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
              onClick={generateSchedule}
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

        {/* Employee Coverage Details */}
        <EmployeeCoverageDetails 
          currentWeek={currentWeek}
        />

        {/* Weekly Availability Overview */}
        <WeeklyAvailabilityOverview 
          currentWeek={currentWeek}
        />

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
                onClick={generateSchedule}
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
  onQuickAdd
}: { 
  shifts: ScheduleShift[]
  dayOfWeek: number
  shiftType: ShiftType
  gaps: Gap[]
  shiftLimits: { dayOfWeek: number; shiftType: string; role: string; minStaff: number; maxStaff: number }[]
  onRemoveShift?: (shift: ScheduleShift) => void
  onEditTime?: (shift: ScheduleShift) => void
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
      allRoles.add(limit.role)
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
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-medium text-gray-700">
                {getRoleName(role)} ({assigned}/{required})
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
                  {onQuickAdd && (
                    <button
                      onClick={() => onQuickAdd(dayOfWeek, shiftType, role)}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                      title={`Aggiungi ${getRoleName(role)}`}
                    >
                      <UserPlus className="h-3 w-3" />
                    </button>
                  )}
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
  const [availabilityStats, setAvailabilityStats] = useState<{
    totalRequired: number
    totalAssigned: number
    totalAvailable: number
    coveragePercentage: number
    availabilityPercentage: number
  } | null>(null)

  useEffect(() => {
    fetchAvailabilityStats()
  }, [schedule, currentWeek])

  const fetchAvailabilityStats = async () => {
    try {
      const response = await fetch(`/api/admin/schedule/coverage-stats?weekStart=${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        setAvailabilityStats(data)
      }
    } catch (error) {
      console.error('Error fetching coverage stats:', error)
    }
  }

  if (!availabilityStats) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center mb-3">
        <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-sm font-medium text-blue-800">
          Resoconto Copertura Turni
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-3">
          <div className="text-xs text-gray-600 mb-1">Turni Assegnati</div>
          <div className="text-lg font-bold text-gray-900">
            {availabilityStats.totalAssigned}/{availabilityStats.totalRequired}
          </div>
          <div className="text-xs text-gray-600">
            {availabilityStats.coveragePercentage.toFixed(1)}% copertura
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, availabilityStats.coveragePercentage)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg p-3">
          <div className="text-xs text-gray-600 mb-1">Disponibilità Inserite</div>
          <div className="text-lg font-bold text-gray-900">
            {availabilityStats.totalAvailable}
          </div>
          <div className="text-xs text-gray-600">
            su {availabilityStats.totalRequired} necessarie
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, availabilityStats.availabilityPercentage)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg p-3">
          <div className="text-xs text-gray-600 mb-1">Efficienza Assegnamento</div>
          <div className="text-lg font-bold text-gray-900">
            {availabilityStats.totalAvailable > 0 
              ? ((availabilityStats.totalAssigned / availabilityStats.totalAvailable) * 100).toFixed(1)
              : 0}%
          </div>
          <div className="text-xs text-gray-600">
            assegnati su disponibili
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(100, availabilityStats.totalAvailable > 0 
                  ? (availabilityStats.totalAssigned / availabilityStats.totalAvailable) * 100 
                  : 0)}%` 
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function EmployeeCoverageDetails({ currentWeek }: { currentWeek: Date }) {
  const [expanded, setExpanded] = useState(false)
  const [employeeStats, setEmployeeStats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Reset when week changes
  useEffect(() => {
    setEmployeeStats([])
    if (expanded) {
      fetchEmployeeStats()
    }
  }, [currentWeek])

  const fetchEmployeeStats = async () => {
    if (!expanded) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/schedule/employee-coverage?weekStart=${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        setEmployeeStats(data)
      }
    } catch (error) {
      console.error('Error fetching employee stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    setExpanded(!expanded)
    if (!expanded) {
      fetchEmployeeStats()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <button
        onClick={handleToggle}
        className="w-full px-6 py-4 text-left focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">
              Dettaglio Copertura per Dipendente
            </h3>
          </div>
          <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Visualizza disponibilità vs turni assegnati per ogni dipendente
        </p>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
              <span className="ml-2 text-gray-600">Caricamento statistiche...</span>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {employeeStats.map((employee) => (
                <div key={employee.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{employee.username}</h4>
                      <p className="text-sm text-gray-600">{employee.primaryRole}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {employee.assigned}/{employee.available} turni
                      </p>
                      <p className="text-xs text-gray-500">
                        {employee.available > 0 ? Math.round((employee.assigned / employee.available) * 100) : 0}% utilizzo
                      </p>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${employee.available > 0 ? Math.min(100, (employee.assigned / employee.available) * 100) : 0}%` 
                      }}
                    />
                  </div>
                  
                  {employee.availableShifts && employee.availableShifts.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Disponibile per:</p>
                        <div className="space-y-1">
                          {employee.availableShifts.map((shift: any, index: number) => (
                            <span key={index} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1">
                              {getDayName(shift.dayOfWeek)} {shift.shiftType}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Assegnato a:</p>
                        <div className="space-y-1">
                          {employee.assignedShifts && employee.assignedShifts.map((shift: any, index: number) => (
                            <span key={index} className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded mr-1">
                              {getDayName(shift.dayOfWeek)} {shift.shiftType}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {employeeStats.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Nessun dato disponibile per questa settimana
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WeeklyAvailabilityOverview({ currentWeek }: { currentWeek: Date }) {
  const [expanded, setExpanded] = useState(false)
  const [availabilityData, setAvailabilityData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Reset when week changes
  useEffect(() => {
    setAvailabilityData(null)
    if (expanded) {
      fetchAvailabilityData()
    }
  }, [currentWeek])

  const fetchAvailabilityData = async () => {
    if (!expanded) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/schedule/weekly-availability?weekStart=${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        setAvailabilityData(data)
      }
    } catch (error) {
      console.error('Error fetching weekly availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    setExpanded(!expanded)
    if (!expanded) {
      fetchAvailabilityData()
    }
  }

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  const shifts = ['PRANZO', 'CENA']

  return (
    <div className="bg-white rounded-lg shadow">
      <button
        onClick={handleToggle}
        className="w-full px-6 py-4 text-left focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">
              Vista Disponibilità Settimanale
            </h3>
          </div>
          <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Vedi chi è disponibile per ogni turno della settimana
        </p>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
              <span className="ml-2 text-gray-600">Caricamento disponibilità...</span>
            </div>
          ) : availabilityData ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-3 border-b-2 border-gray-200 font-semibold text-gray-700">
                      Giorno
                    </th>
                    {shifts.map(shift => (
                      <th key={shift} className="text-left p-3 border-b-2 border-gray-200 font-semibold text-gray-700">
                        {shift === 'PRANZO' ? 'Pranzo (11:00-14:00)' : 'Cena (17:00-22:00)'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((dayName, dayIndex) => (
                    <tr key={dayIndex} className="border-b border-gray-100">
                      <td className="p-3 font-medium text-gray-900">
                        {dayName}
                      </td>
                      {shifts.map(shift => {
                        const availableUsers = availabilityData[dayIndex]?.[shift] || []
                        return (
                          <td key={shift} className="p-3 align-top">
                            {availableUsers.length > 0 ? (
                              <div className="space-y-1">
                                {availableUsers.map((user: any) => (
                                  <span
                                    key={user.id}
                                    className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1 mb-1"
                                  >
                                    {user.username} ({user.primaryRole})
                                  </span>
                                ))}
                                <div className="text-xs text-gray-500 mt-1">
                                  {availableUsers.length} disponibili
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm italic">
                                Nessuno disponibile
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              Nessun dato disponibile per questa settimana
            </p>
          )}
        </div>
      )}
    </div>
  )
}
