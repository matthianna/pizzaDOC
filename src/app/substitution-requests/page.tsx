'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Users, Clock, Calendar, CheckCircle, XCircle, AlertCircle, Send, User, Ban, Sparkles, ArrowRight, Trash2 } from 'lucide-react'
import { format, parseISO, isPast } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { addWeekCalendarDays } from '@/lib/date-utils'
import { Role, ShiftType, SubstitutionStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useHaptics } from '@/hooks/use-haptics'

interface Shift {
  id: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  schedules: {
    weekStart: string
  }
}

interface UserType {
  id: string
  username: string
  primaryRole?: Role
}

interface Substitution {
  id: string
  shiftId: string
  requesterId: string
  substituteId?: string
  status: SubstitutionStatus
  requestNote?: string
  deadline: string
  createdAt: string
  shifts: Shift
  requester: UserType
  substitute?: UserType
}

export default function SubstitutionRequestsPage() {
  const { data: session } = useSession()
  const [availableSubstitutions, setAvailableSubstitutions] = useState<Substitution[]>([])
  const [myRequests, setMyRequests] = useState<Substitution[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedSubstitutionToCancel, setSelectedSubstitutionToCancel] = useState<Substitution | null>(null)
  const { showToast, ToastContainer } = useToast()
  const { lightClick, success, mediumClick } = useHaptics()

  useEffect(() => {
    if (session?.user?.id) {
      fetchSubstitutions()
    }
  }, [session?.user?.id])

  const fetchSubstitutions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/user/substitutions')
      if (response.ok) {
        const data = await response.json()
        setAvailableSubstitutions(data.available)
        setMyRequests(data.mine)
      }
    } catch (error) {
      console.error('Error fetching substitutions:', error)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyForSubstitution = async (substitutionId: string) => {
    lightClick()
    setApplying(substitutionId)
    try {
      const response = await fetch(`/api/user/substitutions/${substitutionId}/apply`, {
        method: 'POST',
      })

      if (response.ok) {
        success()
        showToast('Ti sei candidato con successo!', 'success')
        fetchSubstitutions() // Refresh data
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nella candidatura', 'error')
      }
    } catch (error) {
      console.error('Error applying for substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setApplying(null)
    }
  }

  const openCancelModal = (substitution: Substitution) => {
    setSelectedSubstitutionToCancel(substitution)
    setShowCancelModal(true)
  }

  const closeCancelModal = () => {
    setShowCancelModal(false)
    setSelectedSubstitutionToCancel(null)
  }

  const approveSubstitution = async (substitutionId: string) => {
    lightClick()
    setApproving(substitutionId)
    try {
      const response = await fetch(`/api/substitutions/${substitutionId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ responseNote: null }),
      })

      if (response.ok) {
        success()
        showToast('Sostituzione approvata con successo!', 'success')
        fetchSubstitutions() // Refresh data
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'approvazione', 'error')
      }
    } catch (error) {
      console.error('Error approving substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setApproving(null)
    }
  }

  const confirmCancelSubstitution = async () => {
    if (!selectedSubstitutionToCancel) return

    mediumClick()
    setCancelling(selectedSubstitutionToCancel.id)
    try {
      const response = await fetch(`/api/user/substitutions/${selectedSubstitutionToCancel.id}/cancel`, {
        method: 'POST',
      })

      if (response.ok) {
        showToast('Richiesta di sostituzione annullata con successo', 'success')
        closeCancelModal()
        fetchSubstitutions() // Refresh data
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'annullamento', 'error')
      }
    } catch (error) {
      console.error('Error cancelling substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setCancelling(null)
    }
  }

  const getShiftDate = (shift: Shift) => {
    const weekStart = new Date(shift.schedules.weekStart)
    return addWeekCalendarDays(weekStart, shift.dayOfWeek)
  }

  const getStatusIcon = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'APPLIED': return <User className="h-4 w-4 text-blue-500" />
      case 'APPROVED': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'REJECTED': return <XCircle className="h-4 w-4 text-red-500" />
      case 'EXPIRED': return <AlertCircle className="h-4 w-4 text-gray-700" />
      case 'CANCELLED': return <Ban className="h-4 w-4 text-gray-400" />
      default: return <AlertCircle className="h-4 w-4 text-gray-700" />
    }
  }

  const getStatusText = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING': return 'In attesa'
      case 'APPLIED': return 'Candidato trovato'
      case 'APPROVED': return 'Approvata'
      case 'REJECTED': return 'Rifiutata'
      case 'EXPIRED': return 'Scaduta'
      case 'CANCELLED': return 'Annullata'
      default: return status
    }
  }

  const getStatusColor = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-50 text-yellow-700 border-yellow-100'
      case 'APPLIED': return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'APPROVED': return 'bg-green-50 text-green-700 border-green-100'
      case 'REJECTED': return 'bg-red-50 text-red-700 border-red-100'
      case 'EXPIRED': return 'bg-gray-50 text-gray-700 border-gray-100'
      case 'CANCELLED': return 'bg-gray-50 text-gray-400 border-gray-100'
      default: return 'bg-gray-50 text-gray-700 border-gray-100'
    }
  }

  if (!session) return <div>Loading...</div>

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center tracking-tight">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg mr-4 drop-shadow-orange">
                <Users className="h-6 w-6 text-white" />
              </div>
              Sostituzioni
            </h1>
            <p className="text-gray-500 mt-2 font-medium">Trova una copertura o offriti per un turno</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl shadow-soft p-12 text-center border border-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Caricamento...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Substitutions */}
            <div className="space-y-4">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                <div className="w-1 h-3 bg-orange-500 rounded-full"></div> Richieste Disponibili
              </h2>
              {availableSubstitutions.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8 text-center">
                  <p className="text-gray-400 font-bold text-xs uppercase tracking-tight">Nessuna richiesta disponibile</p>
                </div>
              ) : (
                availableSubstitutions.map((substitution) => {
                  const shiftDate = getShiftDate(substitution.shifts)
                  const [startHour, startMinute] = substitution.shifts.startTime.split(':').map(Number)
                  const shiftStartDateTime = new Date(shiftDate)
                  shiftStartDateTime.setHours(startHour, startMinute, 0, 0)
                  const canApply = substitution.status === 'PENDING' && !isPast(shiftStartDateTime)
                  const isAlreadyApplied = substitution.substitute?.id === session.user.id

                  return (
                    <div key={substitution.id} className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden transition-all">
                      <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded-lg ${getStatusColor(substitution.status)}`}>
                            {getStatusIcon(substitution.status)}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            {getStatusText(substitution.status)}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                          {format(parseISO(substitution.createdAt), 'dd/MM')}
                        </span>
                      </div>

                      <div className="p-5 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${substitution.shifts.shiftType === 'PRANZO' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                            }`}>
                            <span className="text-[10px] uppercase mb-1">{getDayName(substitution.shifts.dayOfWeek).substring(0, 3)}</span>
                            <span className="text-xl">{format(shiftDate, 'dd')}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-gray-900 text-lg uppercase truncate">{getShiftTypeName(substitution.shifts.shiftType)}</h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 text-[10px] font-bold">
                                <Clock className="h-3 w-3 mr-1" /> {substitution.shifts.startTime} - {substitution.shifts.endTime}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 text-[10px] font-bold">
                                <User className="h-3 w-3 mr-1" /> {getRoleName(substitution.shifts.role)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Richiedente</span>
                            <span className="text-sm font-black text-gray-900">{substitution.requester.username}</span>
                          </div>
                          {substitution.requestNote && <p className="text-sm text-gray-600 italic border-t border-white pt-2 leading-relaxed">"{substitution.requestNote}"</p>}
                        </div>

                        {canApply && !isAlreadyApplied && (
                          <Button
                            onClick={() => applyForSubstitution(substitution.id)}
                            disabled={applying === substitution.id}
                            isLoading={applying === substitution.id}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-6 rounded-2xl font-black shadow-lg shadow-orange-500/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                          >
                            <Send className="h-4 w-4 mr-2" /> Candidati Ora
                          </Button>
                        )}
                        {isAlreadyApplied && <div className="w-full py-4 bg-green-50 text-green-700 rounded-2xl text-center text-xs font-black uppercase border border-green-100">✓ Candidatura Inviata</div>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* My Requests */}
            <div className="space-y-4">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                <div className="w-1 h-3 bg-blue-500 rounded-full"></div> Le Mie Richieste
              </h2>
              {myRequests.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8 text-center">
                  <p className="text-gray-400 font-bold text-xs uppercase tracking-tight">Non hai richieste attive</p>
                </div>
              ) : (
                myRequests.map((substitution) => {
                  const shiftDate = getShiftDate(substitution.shifts)
                  return (
                    <div key={substitution.id} className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden transition-all">
                      <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded-lg ${getStatusColor(substitution.status)}`}>
                            {getStatusIcon(substitution.status)}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            {getStatusText(substitution.status)}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{format(parseISO(substitution.createdAt), 'dd/MM')}</span>
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${substitution.shifts.shiftType === 'PRANZO' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                            }`}>
                            <span className="text-[10px] uppercase mb-1">{getDayName(substitution.shifts.dayOfWeek).substring(0, 3)}</span>
                            <span className="text-xl">{format(shiftDate, 'dd')}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-gray-900 text-lg uppercase truncate">{getShiftTypeName(substitution.shifts.shiftType)}</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">{format(shiftDate, 'MMMM yyyy', { locale: it })}</p>
                          </div>
                        </div>
                        {substitution.requestNote && <div className="bg-gray-50 rounded-2xl p-3 border border-gray-50"><p className="text-xs text-gray-600 italic">"{substitution.requestNote}"</p></div>}
                        {substitution.substitute && (
                          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Candidato</span>
                              <span className="text-sm font-black text-blue-900">{substitution.substitute.username}</span>
                            </div>
                            {substitution.status === 'APPLIED' && (
                              <div className="mt-3 space-y-2">
                                <button
                                  onClick={() => approveSubstitution(substitution.id)}
                                  disabled={approving === substitution.id}
                                  className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
                                >
                                  {approving === substitution.id ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                      Approvazione...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4" /> Approva Candidatura
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {['PENDING', 'APPLIED'].includes(substitution.status) && !substitution.substitute && (
                          <button onClick={() => openCancelModal(substitution)} className="w-full flex items-center justify-center gap-2 py-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                            <Trash2 className="h-4 w-4" /> Annulla Richiesta
                          </button>
                        )}
                        {substitution.status === 'PENDING' && substitution.substitute && (
                          <button onClick={() => openCancelModal(substitution)} className="w-full flex items-center justify-center gap-2 py-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all mt-2">
                            <Trash2 className="h-4 w-4" /> Annulla Richiesta
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && selectedSubstitutionToCancel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                <Ban className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Annulla Richiesta</h3>
                <p className="text-xs font-bold text-gray-400 uppercase">Questa azione è irreversibile</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 font-bold text-xs uppercase tracking-tight text-orange-800 space-y-1">
              <p>{getDayName(selectedSubstitutionToCancel.shifts.dayOfWeek)} - {getShiftTypeName(selectedSubstitutionToCancel.shifts.shiftType)}</p>
              <p>{format(getShiftDate(selectedSubstitutionToCancel.shifts), 'dd MMMM yyyy', { locale: it })}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={closeCancelModal} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all" disabled={!!cancelling}>Indietro</button>
              <button onClick={confirmCancelSubstitution} className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-red-500/20" disabled={!!cancelling}>{cancelling ? 'Annullamento...' : 'Conferma'}</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </MainLayout>
  )
}
