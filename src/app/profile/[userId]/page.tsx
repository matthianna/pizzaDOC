'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { User, Calendar, Clock, MapPin, Phone, Briefcase, TrendingUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, getShiftTypeName } from '@/lib/utils'
import { useParams } from 'next/navigation'
import { Role, ShiftType, Transport } from '@prisma/client'

interface UserProfile {
  id: string
  username: string
  phoneNumber: string | null
  primaryRole: Role
  secondaryRoles: Role[]
  primaryTransport: Transport | null
  isActive: boolean
  totalWorkedHours: number
  totalShifts: number
  upcomingShifts: {
    id: string
    dayOfWeek: number
    shiftType: ShiftType
    startTime: string
    endTime: string
    role: Role
    date: string
  }[]
  recentHours: {
    id: string
    submittedAt: string
    shifts: {
      dayOfWeek: number
      shiftType: ShiftType
      startTime: string
      endTime: string
      role: Role
    }
    totalHours: number
  }[]
}

export default function ProfilePage() {
  const params = useParams()
  const userId = params?.userId as string
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      fetchProfile()
    }
  }, [userId])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/user/profile/${userId}`)
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </MainLayout>
    )
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Profilo non trovato</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>
                <p className="text-gray-600 mt-1">
                  {getRoleName(profile.primaryRole)}
                </p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded ${profile.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <span className="text-sm font-semibold">{profile.isActive ? 'Attivo' : 'Non attivo'}</span>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informazioni</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.phoneNumber && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Telefono</p>
                  <p className="text-sm text-gray-900">{profile.phoneNumber}</p>
                </div>
              </div>
            )}
            {profile.primaryTransport && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Trasporto</p>
                  <p className="text-sm text-gray-900">
                    {profile.primaryTransport === 'AUTO' ? '🚗 Auto' : '🏍️ Moto'}
                  </p>
                </div>
              </div>
            )}
            {profile.secondaryRoles.length > 0 && (
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Ruoli Secondari</p>
                  <p className="text-sm text-gray-900">
                    {profile.secondaryRoles.map(r => getRoleName(r)).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-medium text-gray-500">Ore Totali Lavorate</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{profile.totalWorkedHours.toFixed(1)}h</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="text-sm font-medium text-gray-500">Turni Completati</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{profile.totalShifts}</p>
          </div>
        </div>

        {/* Upcoming Shifts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Prossimi Turni</h2>
          {profile.upcomingShifts.length === 0 ? (
            <p className="text-gray-500 text-sm">Nessun turno programmato</p>
          ) : (
            <div className="space-y-3">
              {profile.upcomingShifts.slice(0, 5).map((shift) => (
                <div key={shift.id} className="flex items-center justify-between border-l-4 border-gray-300 pl-4 py-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(parseISO(shift.date), 'EEEE d MMMM', { locale: it })}
                    </p>
                    <p className="text-sm text-gray-600">
                      {getShiftTypeName(shift.shiftType)} - {getRoleName(shift.role)} ({shift.startTime} - {shift.endTime})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Hours */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ore Recenti</h2>
          {profile.recentHours.length === 0 ? (
            <p className="text-gray-500 text-sm">Nessuna ora registrata</p>
          ) : (
            <div className="space-y-3">
              {profile.recentHours.map((hour) => (
                <div key={hour.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100 transition">
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(parseISO(hour.submittedAt), 'dd/MM/yyyy', { locale: it })}
                    </p>
                    <p className="text-xs text-gray-600">
                      {getShiftTypeName(hour.shifts.shiftType)} - {getRoleName(hour.shifts.role)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{hour.totalHours.toFixed(1)}h</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}

