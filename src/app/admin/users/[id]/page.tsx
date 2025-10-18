'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { User, Calendar, Clock, AlertCircle, ArrowLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, getTransportName, getShiftTypeName } from '@/lib/utils'
import { Role, TransportType } from '@prisma/client'

interface UserProfile {
  id: string
  username: string
  isActive: boolean
  isFirstLogin: boolean
  primaryRole: Role
  primaryTransport: TransportType | null
  phoneNumber: string | null
  whatsappEnabled: boolean
  createdAt: string
  updatedAt: string
  user_roles: { role: Role }[]
  user_transports: { transport: TransportType }[]
  shifts: Array<{
    id: string
    dayOfWeek: number
    shiftType: string
    role: string
    startTime: string
    endTime: string
    schedules: {
      weekStart: string
    }
  }>
  worked_hours: Array<{
    id: string
    status: string
    totalHours: number
    startTime: string
    endTime: string
    submittedAt: string
    shifts: {
      dayOfWeek: number
      shiftType: string
      role: string
      schedules: {
        weekStart: string
      }
    }
  }>
  absences: Array<{
    id: string
    startDate: string
    endDate: string
    reason: string
    status: string
  }>
  requestedSubstitutions: Array<{
    id: string
    status: string
    createdAt: string
    shifts: {
      dayOfWeek: number
      shiftType: string
      role: string
      startTime: string
      schedules: {
        weekStart: string
      }
    }
    substitute: {
      username: string
    } | null
  }>
}

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchUser()
    }
  }, [params.id])

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setUser(data)
      } else {
        router.push('/admin/users')
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      router.push('/admin/users')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <MainLayout adminOnly>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </MainLayout>
    )
  }

  if (!user) {
    return null
  }

  const totalHours = user.worked_hours
    .filter(h => h.status === 'APPROVED')
    .reduce((sum, h) => sum + h.totalHours, 0)

  return (
    <MainLayout adminOnly>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/users')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{user.username}</h1>
            <p className="text-sm text-gray-500 mt-1">Profilo Dipendente</p>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">Informazioni Generali</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Stato</div>
              <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                user.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {user.isActive ? 'Attivo' : 'Inattivo'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Ruolo Principale</div>
              <div className="text-sm font-medium text-gray-900">{getRoleName(user.primaryRole)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Tutti i Ruoli</div>
              <div className="text-sm font-medium text-gray-900">
                {user.user_roles.map(r => getRoleName(r.role)).join(', ')}
              </div>
            </div>
            {user.primaryTransport && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Mezzo di Trasporto</div>
                <div className="text-sm font-medium text-gray-900">
                  {getTransportName(user.primaryTransport)}
                </div>
              </div>
            )}
            {user.phoneNumber && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Telefono</div>
                <div className="text-sm font-medium text-gray-900">{user.phoneNumber}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">WhatsApp</div>
              <div className="text-sm font-medium text-gray-900">
                {user.whatsappEnabled ? 'Abilitato' : 'Disabilitato'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Creato il</div>
              <div className="text-sm font-medium text-gray-900">
                {format(parseISO(user.createdAt), 'dd/MM/yyyy', { locale: it })}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-semibold text-gray-900">{user.shifts.length}</div>
            <div className="text-xs text-gray-500 mt-1">Turni Recenti</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-semibold text-gray-900">{totalHours}h</div>
            <div className="text-xs text-gray-500 mt-1">Ore Approvate</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-semibold text-gray-900">{user.absences.length}</div>
            <div className="text-xs text-gray-500 mt-1">Assenze</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-semibold text-gray-900">{user.requestedSubstitutions.length}</div>
            <div className="text-xs text-gray-500 mt-1">Sostituzioni</div>
          </div>
        </div>

        {/* Recent Shifts */}
        {user.shifts.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">Turni Recenti</h2>
            </div>
            <div className="space-y-2">
              {user.shifts.slice(0, 5).map((shift) => (
                <div key={shift.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {getShiftTypeName(shift.shiftType as any)} - {getRoleName(shift.role as Role)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(parseISO(shift.schedules.weekStart), 'dd/MM/yyyy', { locale: it })} · {shift.startTime}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Hours */}
        {user.worked_hours.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">Ore Lavorate Recenti</h2>
            </div>
            <div className="space-y-2">
              {user.worked_hours.slice(0, 5).map((hours) => (
                <div key={hours.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {hours.totalHours}h - {getShiftTypeName(hours.shifts.shiftType as any)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(parseISO(hours.submittedAt), 'dd/MM/yyyy', { locale: it })}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    hours.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    hours.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {hours.status === 'APPROVED' ? 'Approvato' :
                     hours.status === 'PENDING' ? 'In attesa' : 'Rifiutato'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Absences */}
        {user.absences.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">Assenze Recenti</h2>
            </div>
            <div className="space-y-2">
              {user.absences.slice(0, 5).map((absence) => (
                <div key={absence.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{absence.reason}</div>
                    <div className="text-xs text-gray-500">
                      {format(parseISO(absence.startDate), 'dd/MM/yyyy', { locale: it })} - {format(parseISO(absence.endDate), 'dd/MM/yyyy', { locale: it })}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    absence.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    absence.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {absence.status === 'APPROVED' ? 'Approvata' :
                     absence.status === 'PENDING' ? 'In attesa' : 'Rifiutata'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}


