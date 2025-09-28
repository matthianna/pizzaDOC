'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, ChevronLeft, ChevronRight, Play, Download, Trash2, AlertTriangle, UserPlus, Car, Bike } from 'lucide-react'
import { getWeekStart, getNextWeekStart, getWeekDays, formatDate, getDayOfWeek } from '@/lib/date-utils'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { Role, ShiftType, TransportType } from '@prisma/client'
import { AddShiftModal } from '@/components/admin/add-shift-modal'

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
  const [shiftLimits, setShiftLimits] = useState<any[]>([])
  const [missingAvailability, setMissingAvailability] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showAddShiftModal, setShowAddShiftModal] = useState(false)

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
              onClick={() => setShowAddShiftModal(true)}
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
              <h2 className="text-lg font-semibold">
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
                          />
                        </td>
                        <td className="px-6 py-4">
                          <ShiftCrew 
                            shifts={cenaCrew} 
                            dayOfWeek={dayOfWeek}
                            shiftType="CENA"
                            gaps={gaps}
                            shiftLimits={shiftLimits}
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
          onClose={() => setShowAddShiftModal(false)}
          onShiftAdded={() => {
            setShowAddShiftModal(false)
            fetchSchedule() // Refresh the schedule
          }}
        />
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
  shiftLimits 
}: { 
  shifts: ScheduleShift[]
  dayOfWeek: number
  shiftType: ShiftType
  gaps: Gap[]
  shiftLimits: any[]
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
                  <span
                    key={shift.id}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
                  >
                    <span className="flex items-center gap-1">
                      {shift.user.username}
                      {transportIcon}
                    </span>
                  </span>
                )
              })}
              {missing > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600 border border-red-200 border-dashed">
                  Mancano {missing}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
