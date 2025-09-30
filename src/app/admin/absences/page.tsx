'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, MapPin, Heart, User, Clock, Filter, Search, Download } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { format, parseISO, isFuture, isPast, isWithinInterval, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'

interface Absence {
  id: string
  startDate: string
  endDate: string
  type: 'VACATION' | 'SICK_LEAVE' | 'PERSONAL' | 'OTHER'
  reason?: string
  description?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  user: {
    id: string
    username: string
    primaryRole: string
  }
}

export default function AdminAbsencesPage() {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [filteredAbsences, setFilteredAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterTime, setFilterTime] = useState<string>('all')

  useEffect(() => {
    fetchAbsences()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [absences, searchTerm, filterType, filterStatus, filterTime])

  const fetchAbsences = async () => {
    try {
      const response = await fetch('/api/admin/absences')
      if (response.ok) {
        const data = await response.json()
        setAbsences(data)
      }
    } catch (error) {
      console.error('Error fetching absences:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = absences

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(absence =>
        absence.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (absence.reason && absence.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (absence.description && absence.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(absence => absence.type === filterType)
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(absence => absence.status === filterStatus)
    }

    // Time filter
    if (filterTime !== 'all') {
      const today = startOfDay(new Date())
      filtered = filtered.filter(absence => {
        const start = startOfDay(parseISO(absence.startDate))
        const end = startOfDay(parseISO(absence.endDate))
        
        switch (filterTime) {
          case 'future':
            return isFuture(start)
          case 'current':
            return isWithinInterval(today, { start, end })
          case 'past':
            return isPast(end)
          default:
            return true
        }
      })
    }

    setFilteredAbsences(filtered)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'VACATION': return <MapPin className="h-4 w-4 text-blue-600" />
      case 'SICK_LEAVE': return <Heart className="h-4 w-4 text-red-600" />
      case 'PERSONAL': return <User className="h-4 w-4 text-green-600" />
      default: return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'VACATION': return 'Vacanze'
      case 'SICK_LEAVE': return 'Malattia'
      case 'PERSONAL': return 'Permesso Personale'
      case 'OTHER': return 'Altro'
      default: return type
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusName = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approvata'
      case 'PENDING': return 'In Attesa'
      case 'REJECTED': return 'Rifiutata'
      default: return status
    }
  }

  const getTimeStatus = (absence: Absence) => {
    const today = startOfDay(new Date())
    const start = startOfDay(parseISO(absence.startDate))
    const end = startOfDay(parseISO(absence.endDate))

    if (isWithinInterval(today, { start, end })) {
      return { label: 'In corso', color: 'bg-orange-100 text-orange-800' }
    } else if (isFuture(start)) {
      return { label: 'Futura', color: 'bg-blue-100 text-blue-800' }
    } else {
      return { label: 'Passata', color: 'bg-gray-100 text-gray-800' }
    }
  }

  const exportAbsences = () => {
    const csvContent = [
      'Dipendente,Tipo,Stato,Data Inizio,Data Fine,Motivo,Descrizione,Creata il',
      ...filteredAbsences.map(absence => [
        absence.user.username,
        getTypeName(absence.type),
        getStatusName(absence.status),
        format(parseISO(absence.startDate), 'dd/MM/yyyy'),
        format(parseISO(absence.endDate), 'dd/MM/yyyy'),
        absence.reason || '',
        absence.description || '',
        format(parseISO(absence.createdAt), 'dd/MM/yyyy HH:mm')
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `assenze_${format(new Date(), 'yyyy_MM_dd')}.csv`
    link.click()
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </MainLayout>
    )
  }

  const upcomingAbsences = filteredAbsences.filter(a => isFuture(parseISO(a.startDate)))
  const currentAbsences = filteredAbsences.filter(a => {
    const today = startOfDay(new Date())
    return isWithinInterval(today, { 
      start: startOfDay(parseISO(a.startDate)), 
      end: startOfDay(parseISO(a.endDate)) 
    })
  })

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-orange-500 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Gestione Assenze
                </h1>
                <p className="text-gray-600">
                  Visualizza e gestisci le assenze di tutti i dipendenti
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportAbsences}
                className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Esporta CSV
              </button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Totale Assenze</p>
                <p className="text-2xl font-bold text-gray-900">{absences.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">In Corso</p>
                <p className="text-2xl font-bold text-gray-900">{currentAbsences.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <MapPin className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Future</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingAbsences.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Heart className="h-8 w-8 text-red-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Malattie</p>
                <p className="text-2xl font-bold text-gray-900">
                  {absences.filter(a => a.type === 'SICK_LEAVE').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Filter className="h-5 w-5 text-gray-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Filtri</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cerca
              </label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome, motivo..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <Select
                label="Tipo"
                value={filterType}
                onChange={setFilterType}
                options={[
                  { value: 'all', label: 'Tutti i tipi' },
                  { value: 'VACATION', label: 'Vacanze' },
                  { value: 'SICK_LEAVE', label: 'Malattia' },
                  { value: 'PERSONAL', label: 'Permesso Personale' },
                  { value: 'OTHER', label: 'Altro' }
                ]}
              />
            </div>

            <div>
              <Select
                label="Stato"
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'all', label: 'Tutti gli stati' },
                  { value: 'PENDING', label: 'In Attesa' },
                  { value: 'APPROVED', label: 'Approvate' },
                  { value: 'REJECTED', label: 'Rifiutate' }
                ]}
              />
            </div>

            <div>
              <Select
                label="Periodo"
                value={filterTime}
                onChange={setFilterTime}
                options={[
                  { value: 'all', label: 'Tutti i periodi' },
                  { value: 'current', label: 'In corso' },
                  { value: 'future', label: 'Future' },
                  { value: 'past', label: 'Passate' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Absences List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Assenze ({filteredAbsences.length})
            </h2>
          </div>

          {filteredAbsences.length === 0 ? (
            <div className="p-6 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nessuna assenza trovata</p>
              <p className="text-sm text-gray-500 mt-1">
                Modifica i filtri per vedere più risultati
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dipendente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Periodo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dettagli
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAbsences.map((absence) => {
                    const timeStatus = getTimeStatus(absence)
                    return (
                      <tr key={absence.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {absence.user.username}
                              </div>
                              <div className="text-sm text-gray-500">
                                {absence.user.primaryRole}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getTypeIcon(absence.type)}
                            <span className="ml-2 text-sm text-gray-900">
                              {getTypeName(absence.type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {format(parseISO(absence.startDate), 'dd/MM', { locale: it })} -{' '}
                            {format(parseISO(absence.endDate), 'dd/MM/yyyy', { locale: it })}
                          </div>
                          <div className="mt-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${timeStatus.color}`}>
                              {timeStatus.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(absence.status)}`}>
                            {getStatusName(absence.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {absence.reason && (
                              <div><strong>Motivo:</strong> {absence.reason}</div>
                            )}
                            {absence.description && (
                              <div className="mt-1 text-gray-600">
                                {absence.description}
                              </div>
                            )}
                            <div className="mt-1 text-xs text-gray-500">
                              Creata il {format(parseISO(absence.createdAt), 'dd/MM/yyyy HH:mm', { locale: it })}
                            </div>
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
      </div>
    </MainLayout>
  )
}
