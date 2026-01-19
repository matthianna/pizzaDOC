'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { User, Calendar, Clock, MapPin, Phone, Briefcase, TrendingUp, ChevronRight, Star, ShieldCheck, Mail, Smartphone, Bike, Car } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { useParams } from 'next/navigation'
import { Role, ShiftType, Transport } from '@prisma/client'
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'

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
        <div className="max-w-5xl mx-auto space-y-8">
          <Skeleton className="h-48 rounded-[2.5rem]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-32 rounded-[2rem]" />
            <Skeleton className="h-32 rounded-[2rem]" />
          </div>
          <Skeleton className="h-64 rounded-[2.5rem]" />
        </div>
      </MainLayout>
    )
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
            <User className="h-10 w-10 text-gray-300" />
          </div>
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Profilo non trovato</h2>
          <p className="text-gray-500 font-medium">L'utente che stai cercando non esiste o è stato rimosso.</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        {/* Premium Header */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-8">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-red-600 rounded-[2rem] flex items-center justify-center shadow-2xl transform rotate-3">
                  <span className="text-white font-black text-4xl transform -rotate-3">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className={cn(
                  "absolute -bottom-2 -right-2 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg border-2 border-white",
                  profile.isActive ? "bg-green-500 text-white" : "bg-red-500 text-white"
                )}>
                  {profile.isActive ? 'Attivo' : 'Offline'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none">
                    {profile.username}
                  </h1>
                  {profile.primaryRole === 'ADMIN' && (
                    <ShieldCheck className="h-6 w-6 text-orange-500" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-orange-100">
                    {getRoleName(profile.primaryRole)}
                  </span>
                  {profile.secondaryRoles.map((role, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-gray-100">
                      {getRoleName(role)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {profile.phoneNumber && (
                <a 
                  href={`tel:${profile.phoneNumber}`}
                  className="p-4 bg-gray-50 text-gray-400 hover:bg-orange-50 hover:text-orange-600 rounded-2xl transition-all shadow-sm active:scale-90"
                >
                  <Phone className="h-6 w-6" />
                </a>
              )}
              {profile.primaryTransport && (
                <div className="flex items-center gap-3 px-5 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
                  {profile.primaryTransport === 'AUTO' ? <Car className="h-5 w-5 text-blue-500" /> : <Bike className="h-5 w-5 text-orange-500" />}
                  <span className="text-xs font-black text-gray-900 uppercase tracking-widest">{profile.primaryTransport}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ProfileStatCard 
            label="Ore Totali Lavorate" 
            value={`${profile.totalWorkedHours.toFixed(1)}h`}
            icon={Clock} 
            color="orange"
            description="Dall'inizio della collaborazione"
          />
          <ProfileStatCard 
            label="Turni Completati" 
            value={profile.totalShifts}
            icon={TrendingUp} 
            color="green"
            description="Turni regolarmente registrati"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Shifts Section */}
          <div className="space-y-6">
            <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2" />
              Prossimi Turni
            </h3>
            <div className="space-y-4">
              {profile.upcomingShifts.length === 0 ? (
                <div className="bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100 py-12 text-center">
                  <Calendar className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Nessun turno in programma</p>
                </div>
              ) : (
                profile.upcomingShifts.slice(0, 5).map((shift) => (
                  <div key={shift.id} className="bg-white rounded-[2rem] p-5 shadow-soft border border-gray-50 flex items-center justify-between group hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex flex-col items-center justify-center font-black text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                        <span className="text-[10px] leading-none mb-1">{format(parseISO(shift.date), 'EEE', { locale: it }).substring(0,3).toUpperCase()}</span>
                        <span className="text-lg leading-none">{format(parseISO(shift.date), 'd')}</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{getShiftTypeName(shift.shiftType)}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                          {getRoleName(shift.role)} • {shift.startTime} - {shift.endTime}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-orange-500 transition-colors" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Hours Section */}
          <div className="space-y-6">
            <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
              Attività Recente
            </h3>
            <div className="space-y-4">
              {profile.recentHours.length === 0 ? (
                <div className="bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100 py-12 text-center">
                  <Clock className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Ancora nessuna ora registrata</p>
                </div>
              ) : (
                profile.recentHours.map((hour) => (
                  <div key={hour.id} className="bg-white rounded-[2rem] p-5 shadow-soft border border-gray-50 flex items-center justify-between group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                        <Star className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight">
                          {format(parseISO(hour.submittedAt), 'dd MMMM yyyy', { locale: it })}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                          {getShiftTypeName(hour.shifts.shiftType)} • {getRoleName(hour.shifts.role)}
                        </p>
                      </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-2 rounded-xl text-sm font-black text-gray-900">
                      {hour.totalHours.toFixed(1)}h
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

function ProfileStatCard({ label, value, icon: Icon, color, description }: any) {
  const colors: any = {
    orange: 'bg-orange-50 text-orange-600 shadow-orange-100',
    blue: 'bg-blue-50 text-blue-600 shadow-blue-100',
    green: 'bg-green-50 text-green-600 shadow-green-100',
    purple: 'bg-purple-50 text-purple-600 shadow-purple-100'
  }
  
  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100 flex flex-col gap-6 group hover:shadow-lg transition-all duration-500">
      <div className="flex items-center justify-between">
        <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-110", colors[color])}>
          <Icon className="h-8 w-8" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-4xl font-black text-gray-900 tracking-tighter">{value}</p>
        </div>
      </div>
      <div className="pt-6 border-t border-gray-50">
        <p className="text-xs font-medium text-gray-400 italic">{description}</p>
      </div>
    </div>
  )
}
