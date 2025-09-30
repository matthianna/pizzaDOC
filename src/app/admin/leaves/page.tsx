'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, Clock, Check, X, Filter, User, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'

interface Leave {
  id: string
  startDate: string
  endDate: string
  type: 'VACATION' | 'SICK' | 'PERSONAL' | 'FAMILY' | 'OTHER'
  reason?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  updatedAt: string
  user: {
    id: string
    username: string
    primaryRole: string
  }
}

const leaveTypes = {
  VACATION: 'Vacanze',
  SICK: 'Malattia',
  PERSONAL: 'Permesso Personale',
  FAMILY: 'Emergenza Familiare',
  OTHER: 'Altro'
}

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200'
}

const statusIcons = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle
}

const statusLabels = {
  PENDING: 'In Attesa',
  APPROVED: 'Approvato',
  REJECTED: 'Rifiutato'
}

export default function AdminLeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    fetchLeaves()
  }, [filter])

  const fetchLeaves = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'ALL') {
        params.append('status', filter)
      }

      const response = await fetch(`/api/admin/leaves?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLeaves(data)
      } else {
        showToast('Errore nel caricamento delle assenze', 'error')
      }
    } catch (error) {
      showToast('Errore di connessione', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (leaveId: string) => {
    setProcessingId(leaveId)
    try {
      const response = await fetch(`/api/admin/leaves/${leaveId}/approve`, {
        method: 'POST'
      })

      if (response.ok) {
        showToast('Richiesta approvata con successo', 'success')
        fetchLeaves()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'approvazione', 'error')
      }
    } catch (error) {
      showToast('Errore di connessione', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (leaveId: string) => {
    if (!confirm('Sei sicuro di voler rifiutare questa richiesta di assenza?')) {
      return
    }

    setProcessingId(leaveId)
    try {
      const response = await fetch(`/api/admin/leaves/${leaveId}/reject`, {
        method: 'POST'
      })

      if (response.ok) {
        showToast('Richiesta rifiutata', 'success')
        fetchLeaves()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nel rifiuto', 'error')
      }
    } catch (error) {
      showToast('Errore di connessione', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const filteredLeaves = leaves.filter(leave => {
    if (filter === 'ALL') return true
    return leave.status === filter
  })

  const pendingCount = leaves.filter(l => l.status === 'PENDING').length
  const approvedCount = leaves.filter(l => l.status === 'APPROVED').length
  const rejectedCount = leaves.filter(l => l.status === 'REJECTED').length

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-6 w-6 text-orange-500 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestione Assenze</h1>
              <p className="text-gray-600">Visualizza e gestisci le richieste di assenza dei dipendenti</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Totale</p>
                <p className="text-2xl font-bold text-gray-900">{leaves.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">In Attesa</p>
                <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Approvate</p>
                <p className="text-2xl font-bold text-gray-900">{approvedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Rifiutate</p>
                <p className="text-2xl font-bold text-gray-900">{rejectedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtra per stato:</span>
            <div className="flex gap-2">
              {[
                { key: 'ALL', label: 'Tutte', count: leaves.length },
                { key: 'PENDING', label: 'In Attesa', count: pendingCount },
                { key: 'APPROVED', label: 'Approvate', count: approvedCount },
                { key: 'REJECTED', label: 'Rifiutate', count: rejectedCount }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === key
                      ? 'bg-orange-100 text-orange-800 border border-orange-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leaves List */}
        <div className="bg-white rounded-lg shadow">
          {filteredLeaves.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'ALL' ? 'Nessuna richiesta' : `Nessuna richiesta ${statusLabels[filter as keyof typeof statusLabels]?.toLowerCase()}`}
              </h3>
              <p className="text-gray-600">
                {filter === 'ALL' 
                  ? 'Non ci sono richieste di assenza al momento.'
                  : `Non ci sono richieste ${statusLabels[filter as keyof typeof statusLabels]?.toLowerCase()}.`
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredLeaves.map((leave) => {
                const StatusIcon = statusIcons[leave.status]
                const isProcessing = processingId === leave.id

                return (
                  <div key={leave.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-gray-900">{leave.user.username}</span>
                            <span className="text-sm text-gray-500">({leave.user.primaryRole})</span>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[leave.status]}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusLabels[leave.status]}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                          <div>
                            <div className="text-sm font-medium text-gray-700">Tipo</div>
                            <div className="text-sm text-gray-900">{leaveTypes[leave.type]}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">Periodo</div>
                            <div className="text-sm text-gray-900">
                              {format(parseISO(leave.startDate), 'dd/MM/yyyy', { locale: it })} 
                              {' - '}
                              {format(parseISO(leave.endDate), 'dd/MM/yyyy', { locale: it })}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">Richiesta inviata</div>
                            <div className="text-sm text-gray-900">
                              {format(parseISO(leave.createdAt), 'dd/MM/yyyy HH:mm', { locale: it })}
                            </div>
                          </div>
                        </div>
                        
                        {leave.reason && (
                          <div className="mb-3">
                            <div className="text-sm font-medium text-gray-700 mb-1">Motivo</div>
                            <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                              {leave.reason}
                            </div>
                          </div>
                        )}
                      </div>

                      {leave.status === 'PENDING' && (
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            onClick={() => handleApprove(leave.id)}
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-sm"
                          >
                            {isProcessing ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Approva
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleReject(leave.id)}
                            disabled={isProcessing}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm"
                          >
                            {isProcessing ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Rifiuta
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <ToastContainer />
      </div>
    </MainLayout>
  )
}
