'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { MainLayout } from '@/components/layout/main-layout'
import { Clock, Check, X, AlertCircle, Edit2, ChevronDown, ChevronRight, User } from 'lucide-react'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'
import { Role, ShiftType, HoursStatus } from '@prisma/client'
import { Select as ReactSelect } from '@/components/ui/react-select'
import { Skeleton, TableSkeleton, CardSkeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { useHaptics } from '@/hooks/use-haptics'

interface Shift {
  id: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  schedule: {
    weekStart: string
  }
}

interface WorkedHours {
  id: string
  shiftId: string
  startTime: string
  endTime: string
  totalHours: number
  status: HoursStatus
  rejectionReason?: string
  submittedAt: string
  reviewedAt?: string
  user: {
    id: string
    username: string
    primaryRole: Role
  }
  shift: Shift
}

export default function AdminHoursPage() {
  const [workedHours, setWorkedHours] = useState<WorkedHours[]>([])
  const [filterStatus, setFilterStatus] = useState<HoursStatus | 'ALL'>('PENDING')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [editingHours, setEditingHours] = useState<WorkedHours | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  const { lightClick, success: successClick } = useHaptics()

  const isAdminUser = true // This is an admin page

  useEffect(() => {
    fetchWorkedHours()
  }, [filterStatus, selectedMonth, selectedYear])

  const fetchWorkedHours = async () => {
    setLoading(true)
    try {
      let url = `/api/admin/hours?month=${selectedMonth}&year=${selectedYear}`
      if (filterStatus !== 'ALL') {
        url += `&status=${filterStatus}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setWorkedHours(data)
      }
    } catch (error) {
      console.error('Error fetching worked hours:', error)
    } finally {
      setLoading(false)
    }
  }

  const approveHours = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/hours/${id}/approve`, {
        method: 'POST'
      })

      if (response.ok) {
        successClick()
        fetchWorkedHours()
      } else {
        console.error('Errore durante l\'approvazione')
      }
    } catch (error) {
      console.error('Error approving hours:', error)
    }
  }

  const rejectHours = async (id: string, reason: string) => {
    try {
      const response = await fetch(`/api/admin/hours/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        setRejectingId(null)
        setRejectReason('')
        successClick()
        fetchWorkedHours()
      } else {
        console.error('Errore durante il rifiuto')
      }
    } catch (error) {
      console.error('Error rejecting hours:', error)
    }
  }

  const openEditModal = (hours: WorkedHours) => {
    lightClick()
    setEditingHours(hours)
    setEditStartTime(hours.startTime)
    setEditEndTime(hours.endTime)
  }

  const closeEditModal = () => {
    setEditingHours(null)
    setEditStartTime('')
    setEditEndTime('')
  }

  const saveEditedHours = async () => {
    if (!editingHours) return

    try {
      const response = await fetch(`/api/admin/hours/${editingHours.id}/edit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime: editStartTime,
          endTime: editEndTime
        })
      })

      if (response.ok) {
        closeEditModal()
        successClick()
        fetchWorkedHours()
      } else {
        const error = await response.json()
        console.error(error.error || 'Errore durante la modifica')
      }
    } catch (error) {
      console.error('Error editing hours:', error)
    }
  }

  const calculateTotalHours = (start: string, end: string): number => {
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60
    }
    
    return totalMinutes / 60
  }

  // Genera opzioni di orario con offset ±30 min dal turno originale
  const generateTimeOptions = (baseTime: string): { value: string; label: string }[] => {
    const [hour, minute] = baseTime.split(':').map(Number)
    const baseMinutes = hour * 60 + minute
    
    const options: { value: string; label: string }[] = []
    
    // Da -60 minuti a +60 minuti, con step di 30 minuti
    for (let offset = -60; offset <= 60; offset += 30) {
      let totalMinutes = baseMinutes + offset
      
      // Gestisci wrap around (es. 23:30 + 60 = 00:30)
      if (totalMinutes < 0) totalMinutes += 24 * 60
      if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60
      
      const h = Math.floor(totalMinutes / 60)
      const m = totalMinutes % 60
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      
      options.push({
        value: timeStr,
        label: timeStr
      })
    }
    
    return options
  }

  const getShiftDate = (shift: Shift): Date => {
    const weekStart = new Date(shift.schedule.weekStart)
    const shiftDate = new Date(weekStart)
    shiftDate.setDate(shiftDate.getDate() + shift.dayOfWeek)
    return shiftDate
  }

  const getStatusColor = (status: HoursStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: HoursStatus) => {
    switch (status) {
      case 'PENDING':
        return 'In attesa'
      case 'APPROVED':
        return 'Approvate'
      case 'REJECTED':
        return 'Rifiutate'
      default:
        return status
    }
  }

  const totalHours = workedHours.reduce((sum, h) => sum + h.totalHours, 0)
  const pendingCount = workedHours.filter(h => h.status === 'PENDING').length

  // Raggruppa per utente
  const groupedByUser = workedHours.reduce((acc, hours) => {
    const userId = hours.user.id
    if (!acc[userId]) {
      acc[userId] = {
        user: hours.user,
        hours: [],
        totalHours: 0
      }
    }
    acc[userId].hours.push(hours)
    acc[userId].totalHours += hours.totalHours
    return acc
  }, {} as Record<string, { user: { id: string; username: string; primaryRole: Role }; hours: WorkedHours[]; totalHours: number }>)

  const userGroups = Object.values(groupedByUser).sort((a, b) => 
    a.user.username.localeCompare(b.user.username)
  )

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

  return (
    <MainLayout adminOnly>
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        {/* Header con stile Premium */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-orange-100 transform -rotate-3">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
                  Gestione Ore Lavorate
                </h1>
                <p className="text-gray-500 mt-2 text-sm font-medium">
                  Controlla e approva le ore inviate dal tuo team.
                </p>
              </div>
            </div>

            {/* Quick Stats Summary */}
            <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">In Attesa</p>
                <p className="text-3xl font-black text-orange-600 leading-none">{pendingCount}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ore Totali</p>
                <p className="text-3xl font-black text-gray-900 leading-none">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-[2rem] shadow-soft border border-gray-100 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ReactSelect
              label="Stato Approvazione"
              options={[
                { value: 'ALL', label: 'Tutti gli stati' },
                { value: 'PENDING', label: '⏳ In attesa' },
                { value: 'APPROVED', label: '✅ Approvate' },
                { value: 'REJECTED', label: '❌ Rifiutate' }
              ]}
              value={{ value: filterStatus, label: filterStatus === 'ALL' ? 'Tutti gli stati' : filterStatus === 'PENDING' ? '⏳ In attesa' : filterStatus === 'APPROVED' ? '✅ Approvate' : '❌ Rifiutate' }}
              onChange={(option) => {
                lightClick()
                setFilterStatus(option?.value as HoursStatus | 'ALL' || 'ALL')
              }}
            />
            
            <ReactSelect
              label="Mese"
              options={Array.from({ length: 12 }, (_, i) => ({
                value: i + 1,
                label: new Date(2024, i).toLocaleDateString('it-IT', { month: 'long' })
              }))}
              value={{ value: selectedMonth, label: new Date(2024, selectedMonth - 1).toLocaleDateString('it-IT', { month: 'long' }) }}
              onChange={(option) => {
                lightClick()
                setSelectedMonth(option?.value as number || 1)
              }}
            />

            <ReactSelect
              label="Anno"
              options={[2024, 2025, 2026].map(year => ({
                value: year,
                label: year.toString()
              }))}
              value={{ value: selectedYear, label: selectedYear.toString() }}
              onChange={(option) => {
                lightClick()
                setSelectedYear(option?.value as number || 2024)
              }}
            />
          </div>
        </div>

        {/* Worked Hours List */}
        <div className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              <TableSkeleton cols={5} rows={3} />
              <TableSkeleton cols={5} rows={3} />
            </div>
          ) : userGroups.length > 0 ? (
            userGroups.map((group) => {
              const isExpanded = expandedUsers.has(group.user.id)
              const groupPendingCount = group.hours.filter(h => h.status === 'PENDING').length
              
              return (
                <div key={group.user.id} className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden group/user transition-all duration-300">
                  {/* User Group Header */}
                  <button
                    onClick={() => {
                      lightClick()
                      toggleUser(group.user.id)
                    }}
                    className={cn(
                      "w-full px-8 py-6 flex items-center justify-between transition-all duration-300 text-left",
                      isExpanded ? "bg-orange-50/50 border-b border-orange-100" : "bg-white hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                        isExpanded ? "bg-orange-600 text-white shadow-lg shadow-orange-100" : "bg-gray-100 text-gray-400 group-hover/user:bg-orange-100 group-hover/user:text-orange-600"
                      )}>
                        <User className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-gray-900 leading-none">{group.user.username}</h3>
                          {groupPendingCount > 0 && (
                            <span className="px-2 py-1 bg-orange-600 text-white text-[10px] font-black uppercase rounded-full animate-pulse">
                              {groupPendingCount} PENDING
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">{getRoleName(group.user.primaryRole)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="hidden sm:flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Turni</p>
                          <p className="text-xl font-black text-gray-900 leading-none">{group.hours.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Totali</p>
                          <p className="text-xl font-black text-orange-600 leading-none">{group.totalHours.toFixed(1)}h</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 transition-all duration-300",
                        isExpanded && "bg-orange-100 text-orange-600 rotate-180"
                      )}>
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content: Shifts Table */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Giorno e Turno</th>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Orario Lavorato</th>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Ore</th>
                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Stato</th>
                            <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {group.hours.map((hours) => {
                            const shiftDate = getShiftDate(hours.shift)
                            return (
                              <tr key={hours.id} className="hover:bg-gray-50/50 transition-colors group/row">
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex flex-col items-center justify-center font-black text-gray-400 border border-gray-100">
                                      <span className="text-[8px] uppercase leading-none">{getDayName(hours.shift.dayOfWeek).substring(0, 3)}</span>
                                      <span className="text-sm leading-none mt-1">{format(shiftDate, 'd')}</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-gray-900 leading-tight">
                                        {getShiftTypeName(hours.shift.shiftType)}
                                      </p>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                                        {getRoleName(hours.shift.role)}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-900">{hours.startTime}</span>
                                    <span className="text-gray-300 text-xs">→</span>
                                    <span className="text-sm font-bold text-gray-900">{hours.endTime}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-center">
                                  <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-900 text-xs font-black rounded-lg">
                                    {hours.totalHours.toFixed(1)}h
                                  </span>
                                </td>
                                <td className="px-8 py-5 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={cn(
                                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                      hours.status === 'PENDING' ? "bg-yellow-100 text-yellow-700" :
                                      hours.status === 'APPROVED' ? "bg-green-100 text-green-700" :
                                      "bg-red-100 text-red-700"
                                    )}>
                                      {getStatusText(hours.status)}
                                    </span>
                                    {hours.status === 'REJECTED' && hours.rejectionReason && (
                                      <p className="text-[9px] text-red-500 font-bold max-w-[120px] truncate" title={hours.rejectionReason}>
                                        {hours.rejectionReason}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => openEditModal(hours)}
                                      className="p-2 bg-gray-100 text-gray-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all active:scale-90"
                                      title="Modifica"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    {hours.status === 'PENDING' && (
                                      <>
                                        <button
                                          onClick={() => approveHours(hours.id)}
                                          className="p-2 bg-gray-100 text-gray-400 hover:bg-green-600 hover:text-white rounded-xl transition-all active:scale-90"
                                          title="Approva"
                                        >
                                          <Check className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            lightClick()
                                            setRejectingId(hours.id)
                                          }}
                                          className="p-2 bg-gray-100 text-gray-400 hover:bg-red-600 hover:text-white rounded-xl transition-all active:scale-90"
                                          title="Rifiuta"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="bg-white rounded-[3rem] border-2 border-dashed border-gray-100 py-20 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="h-10 w-10 text-gray-200" />
              </div>
              <h3 className="text-gray-400 font-black uppercase tracking-[0.2em] text-sm">Nessuna ora trovata per questi filtri</h3>
            </div>
          )}
        </div>
      </div>

      {/* Edit Hours Modal - Using Common Modal Component */}
      <Modal
        isOpen={!!editingHours}
        onClose={closeEditModal}
        title="Modifica Ore"
        subtitle={editingHours ? `${editingHours.user.username} • ${getDayName(editingHours.shift.dayOfWeek)} ${getShiftTypeName(editingHours.shift.shiftType)}` : ''}
        headerIcon={<Edit2 className="h-6 w-6" />}
        maxWidth="lg"
      >
        {editingHours && (
          <div className="space-y-8 pt-4">
            {/* Shift Info Header */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-[2rem] p-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Orario Turno Originale</p>
                <p className="text-xl font-black text-gray-900">{editingHours.shift.startTime} - {editingHours.shift.endTime}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ruolo Assegnato</p>
                <p className="text-xl font-black text-gray-900">{getRoleName(editingHours.shift.role)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Ora Inizio</label>
                <ReactSelect
                  options={generateTimeOptions(editingHours.shift.startTime)}
                  value={editStartTime ? { value: editStartTime, label: editStartTime } : null}
                  onChange={(option) => {
                    lightClick()
                    setEditStartTime(option?.value?.toString() || '')
                  }}
                  placeholder="Seleziona..."
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Ora Fine</label>
                <ReactSelect
                  options={generateTimeOptions(editingHours.shift.endTime)}
                  value={editEndTime ? { value: editEndTime, label: editEndTime } : null}
                  onChange={(option) => {
                    lightClick()
                    setEditEndTime(option?.value?.toString() || '')
                  }}
                  placeholder="Seleziona..."
                />
              </div>
            </div>

            {/* Live Result Display */}
            {editStartTime && editEndTime && (
              <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-[2rem] p-8 shadow-xl shadow-orange-100 flex items-center justify-between text-white">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Ricalcolo Ore Totali</h4>
                  <p className="text-lg font-bold mt-1">{editStartTime} – {editEndTime}</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black">{calculateTotalHours(editStartTime, editEndTime).toFixed(1)}h</p>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                onClick={closeEditModal}
                className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95"
              >
                Annulla
              </button>
              <button
                onClick={saveEditedHours}
                disabled={!editStartTime || !editEndTime}
                className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-100 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                Salva Modifiche
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectingId}
        onClose={() => {
          setRejectingId(null)
          setRejectReason('')
        }}
        title="Rifiuta Ore"
        headerIcon={<X className="h-6 w-6" />}
      >
        <div className="space-y-6 pt-4">
          <div className="bg-red-50 rounded-[1.5rem] p-5 border border-red-100">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <p className="text-sm font-bold text-red-800 leading-tight">
                Le ore verranno rimandate al dipendente per essere corrette. Specifica il motivo qui sotto.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Motivo del rifiuto</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-[2rem] px-6 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:border-orange-500 transition-all resize-none"
              placeholder="Esempio: L'orario di fine non corrisponde alla chiusura effettiva..."
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={() => {
                setRejectingId(null)
                setRejectReason('')
              }}
              className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95"
            >
              Annulla
            </button>
            <button
              onClick={() => rejectHours(rejectingId!, rejectReason)}
              disabled={!rejectReason.trim()}
              className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-100 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              Rifiuta Ore
            </button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}
