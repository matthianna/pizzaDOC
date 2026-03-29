'use client'

import { useState, useEffect, type ComponentType, type FormEvent } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Plus, Edit, Trash2, RotateCcw, Users, X, Bell, BellOff, Check, Clock, ChevronRight, ShieldCheck, Mail, Star, UserPlus, Trash, RotateCw, ShieldAlert, Smartphone, AppWindow } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { it as localeIt } from 'date-fns/locale'
import { cn, getRoleName, getTransportName } from '@/lib/utils'
import { Role, TransportType } from '@prisma/client'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { useHaptics } from '@/hooks/use-haptics'

const CLIENT_PRESENCE_STALE_MS = 25 * 60 * 1000

interface User {
  id: string
  username: string
  isActive: boolean
  trackHours: boolean
  pushNotificationsEnabled: boolean
  primaryRole: Role
  primaryTransport: TransportType | null
  createdAt: string
  lastClientDisplayMode: string | null
  lastClientDisplayModeAt: string | null
  notificationPermissionReported: string | null
  notificationPermissionReportedAt: string | null
  clientPushSubscribedReported: boolean | null
  clientPushSubscribedReportedAt: string | null
  engagementPwaSnoozeCount: number
  engagementPwaSnoozedUntil: string | null
  engagementPushSnoozeCount: number
  engagementPushSnoozedUntil: string | null
  user_roles: { role: Role }[]
  user_transports: { transport: TransportType }[]
  push_subscriptions: { id: string }[]
}

function getClientAppPresence(user: Pick<User, 'lastClientDisplayMode' | 'lastClientDisplayModeAt'>) {
  if (!user.lastClientDisplayModeAt || !user.lastClientDisplayMode) {
    return { variant: 'none' as const }
  }
  const at = new Date(user.lastClientDisplayModeAt).getTime()
  const fresh = Date.now() - at <= CLIENT_PRESENCE_STALE_MS
  const isPwa =
    user.lastClientDisplayMode === 'standalone' || user.lastClientDisplayMode === 'fullscreen'
  return {
    variant: fresh ? (isPwa ? ('pwa' as const) : ('browser' as const)) : ('stale' as const),
    at: user.lastClientDisplayModeAt,
    lastMode: user.lastClientDisplayMode
  }
}

function ClientAppCell({ user, engagementMax }: { user: User; engagementMax: number }) {
  const p = getClientAppPresence(user)
  const pwaSnooze = user.engagementPwaSnoozeCount ?? 0
  const pushSnooze = user.engagementPushSnoozeCount ?? 0

  const main =
    p.variant === 'none' ? (
      <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">—</span>
    ) : p.variant === 'pwa' ? (
      <div className="flex flex-col gap-0.5 max-w-[140px]">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
          <span className="w-2 h-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
          App PWA
        </span>
        <span className="text-[9px] font-medium leading-tight text-gray-400">
          {formatDistanceToNow(new Date(p.at), { addSuffix: true, locale: localeIt })}
        </span>
      </div>
    ) : p.variant === 'browser' ? (
      <div className="flex flex-col gap-0.5 max-w-[140px]">
        <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">Browser</span>
        <span className="text-[9px] font-medium leading-tight text-gray-400">
          {formatDistanceToNow(new Date(p.at), { addSuffix: true, locale: localeIt })}
        </span>
      </div>
    ) : (
      <div className="flex max-w-[160px] flex-col gap-0.5">
        <span className="text-[10px] font-bold text-gray-500">
          {p.lastMode === 'browser' ? 'Ultimo: browser' : 'Ultimo: app'}
        </span>
        <span className="text-[9px] font-medium leading-tight text-gray-400" title="Oltre 25 min fa">
          {formatDistanceToNow(new Date(p.at), { addSuffix: true, locale: localeIt })}
        </span>
      </div>
    )

  return (
    <div className="max-w-[220px] space-y-2">
      {main}
      <div className="space-y-1 border-t border-gray-100 pt-2 text-[8px] leading-snug text-gray-400">
        {user.notificationPermissionReported && (
          <p>
            Permesso notif.:{' '}
            <span className="font-bold text-gray-600">{user.notificationPermissionReported}</span>
            {user.notificationPermissionReportedAt && (
              <span className="mt-0.5 block text-[7px] opacity-80">
                {formatDistanceToNow(new Date(user.notificationPermissionReportedAt), {
                  addSuffix: true,
                  locale: localeIt
                })}
              </span>
            )}
          </p>
        )}
        {user.clientPushSubscribedReported != null && (
          <p>
            Iscrizione push (client):{' '}
            <span className="font-bold text-gray-600">{user.clientPushSubscribedReported ? 'sì' : 'no'}</span>
          </p>
        )}
        <p>
          Posticipazioni banner: app {pwaSnooze}/{engagementMax} · push {pushSnooze}/{engagementMax}
        </p>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [engagementMaxSnoozes, setEngagementMaxSnoozes] = useState(7)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const { lightClick, success: successClick, error: errorClick } = useHaptics()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setUsers(data)
          setEngagementMaxSnoozes(7)
        } else {
          setUsers(data.users ?? [])
          setEngagementMaxSnoozes(data.meta?.engagementMaxSnoozesPerType ?? 7)
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const openDeleteConfirm = (user: User) => {
    lightClick()
    setDeletingUser(user)
    setShowDeleteConfirm(true)
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return

    try {
      const userId = deletingUser.id
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        successClick()
        setUsers(users.filter(u => u.id !== userId))
        setShowDeleteConfirm(false)
        setDeletingUser(null)
      } else {
        errorClick()
        alert('Errore durante l\'eliminazione')
      }
    } catch (error) {
      errorClick()
      console.error('Error deleting user:', error)
      alert('Errore durante l\'eliminazione')
    }
  }

  const handleResetPassword = async (userId: string) => {
    lightClick()
    if (!confirm('Sei sicuro di voler resettare la password di questo utente?')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST'
      })

      if (response.ok) {
        successClick()
        alert('Password resettata con successo. La nuova password è il nome utente.')
      } else {
        errorClick()
        alert('Errore durante il reset della password')
      }
    } catch (error) {
      errorClick()
      console.error('Error resetting password:', error)
      alert('Errore durante il reset della password')
    }
  }

  const togglePushNotifications = async (userId: string, currentValue: boolean) => {
    lightClick()
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pushNotificationsEnabled: !currentValue
        })
      })

      if (response.ok) {
        successClick()
        setUsers(users.map(u =>
          u.id === userId
            ? { ...u, pushNotificationsEnabled: !currentValue }
            : u
        ))
      } else {
        errorClick()
        alert('Errore durante l\'aggiornamento delle notifiche Push')
      }
    } catch (error) {
      errorClick()
      console.error('Error toggling Push notifications:', error)
      alert('Errore durante l\'aggiornamento delle notifiche Push')
    }
  }

  if (loading) {
    return (
      <MainLayout adminOnly>
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-40 rounded-[2.5rem]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-28 rounded-[2rem]" />
            <Skeleton className="h-28 rounded-[2rem]" />
            <Skeleton className="h-28 rounded-[2rem]" />
          </div>
          <TableSkeleton rows={8} cols={7} />
        </div>
      </MainLayout>
    )
  }

  const activeUsers = users.filter(user => user.isActive)
  const inactiveUsers = users.filter(user => !user.isActive)

  const pushEnabledCount = activeUsers.filter(u => u.pushNotificationsEnabled).length
  const pushSubscribedCount = activeUsers.filter(u => u.push_subscriptions?.length > 0).length
  const pwaLiveCount = activeUsers.filter(u => getClientAppPresence(u).variant === 'pwa').length
  const browserLiveCount = activeUsers.filter(u => getClientAppPresence(u).variant === 'browser').length

  return (
    <MainLayout adminOnly>
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        {/* Premium Header */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-orange-100 transform -rotate-3">
                <Users className="h-8 w-8 text-white" />
              </div>
          <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
                  Gestione Squadra
            </h1>
                <p className="text-gray-500 mt-2 text-sm font-medium">
                  Controlla i profili, i ruoli e i permessi di tutti i collaboratori.
            </p>
          </div>
            </div>

          <button
              onClick={() => {
                lightClick()
                setShowCreateForm(true)
              }}
              className="px-8 py-4 bg-gradient-primary text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-orange-500/20 hover:brightness-110 transition-all active:scale-95 flex items-center gap-3"
            >
              <UserPlus className="h-5 w-5" />
              Nuovo Collaboratore
          </button>
          </div>
        </div>

        {/* Notification Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="Push Abilitate" 
            value={`${pushEnabledCount} / ${activeUsers.length}`}
            icon={Bell} 
            color="orange" 
          />
          <StatCard 
            label="Dispositivi Collegati" 
            value={pushSubscribedCount}
            icon={Smartphone} 
            color="green" 
          />
          <StatCard 
            label="In app PWA (live)" 
            value={`${pwaLiveCount} / ${activeUsers.length}`}
            icon={AppWindow} 
            color="green" 
            hint="Ultimi 25 min"
          />
          <StatCard 
            label="Push Disabilitate" 
            value={activeUsers.length - pushEnabledCount}
            icon={BellOff} 
            color="red" 
          />
        </div>
        {browserLiveCount > 0 && (
          <p className="text-[10px] font-bold text-sky-700/80 uppercase tracking-widest px-1">
            In browser (live): {browserLiveCount} — dati inviati dal client ogni pochi minuti
          </p>
        )}

        {/* Active Users Table */}
        <div className="space-y-6">
          <SectionHeader title="Collaboratori Attivi" count={activeUsers.length} color="green" />
          
          <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Utente</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Abilitazioni</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Trasporti</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Client app</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Notifiche</th>
                    <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Azioni</th>
                </tr>
              </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeUsers.map(user => (
                    <UserRow 
                      key={user.id} 
                      user={user} 
                      engagementMax={engagementMaxSnoozes}
                      onEdit={() => setEditingUser(user)}
                      onDelete={() => openDeleteConfirm(user)}
                      onResetPassword={() => handleResetPassword(user.id)}
                      onTogglePush={() => togglePushNotifications(user.id, user.pushNotificationsEnabled)}
                    />
              ))}
            </tbody>
          </table>
          </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 p-6 sm:hidden">
              {activeUsers.map(user => (
                <UserMobileCard 
                  key={user.id} 
                  user={user} 
                  engagementMax={engagementMaxSnoozes}
                  onEdit={() => setEditingUser(user)}
                  onDelete={() => openDeleteConfirm(user)}
                  onResetPassword={() => handleResetPassword(user.id)}
                  onTogglePush={() => togglePushNotifications(user.id, user.pushNotificationsEnabled)}
                />
              ))}
            </div>

            {activeUsers.length === 0 && (
              <div className="py-20 text-center">
                <Users className="h-16 w-16 text-gray-100 mx-auto mb-4" />
                <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Nessun collaboratore attivo</p>
            </div>
          )}
          </div>
        </div>

        {/* Inactive Users Table */}
        {inactiveUsers.length > 0 && (
          <div className="space-y-6">
            <SectionHeader title="Account Disattivati" count={inactiveUsers.length} color="red" />
            
            <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden opacity-70">
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-50">
                    {inactiveUsers.map(user => (
                      <UserRow 
                        key={user.id} 
                        user={user} 
                        engagementMax={engagementMaxSnoozes}
                        onEdit={() => setEditingUser(user)}
                        onDelete={() => openDeleteConfirm(user)}
                        onResetPassword={() => handleResetPassword(user.id)}
                        onTogglePush={() => togglePushNotifications(user.id, user.pushNotificationsEnabled)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 gap-4 p-6 sm:hidden">
                {inactiveUsers.map(user => (
                  <UserMobileCard 
                    key={user.id} 
                    user={user} 
                    engagementMax={engagementMaxSnoozes}
                    onEdit={() => setEditingUser(user)}
                    onDelete={() => openDeleteConfirm(user)}
                    onResetPassword={() => handleResetPassword(user.id)}
                    onTogglePush={() => togglePushNotifications(user.id, user.pushNotificationsEnabled)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateForm && (
        <UserFormModal
          onClose={() => setShowCreateForm(false)}
          onSave={() => {
            setShowCreateForm(false)
            fetchUsers()
          }}
        />
      )}

      {editingUser && (
        <UserFormModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={() => {
            setEditingUser(null)
            fetchUsers()
          }}
        />
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeletingUser(null)
        }}
        onConfirm={handleDeleteUser}
        title="Elimina Utente"
        description="Stai per eliminare definitivamente questo utente. Tutti i suoi dati associati (disponibilità, ore lavorate, turni) verranno eliminati. Questa azione NON può essere annullata."
        confirmPhrase="ELIMINA UTENTE"
        confirmButtonText="Elimina Utente"
        isDangerous={true}
        metadata={
          deletingUser && (
            <div className="text-sm font-bold text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="flex justify-between mb-1"><span>Username:</span> <span className="text-gray-900">{deletingUser.username}</span></div>
              <div className="flex justify-between"><span>Ruolo:</span> <span className="text-gray-900">{getRoleName(deletingUser.primaryRole)}</span></div>
            </div>
          )
        }
      />
    </MainLayout>
  )
}

function SectionHeader({ title, count, color }: any) {
  const colors: any = {
    green: 'bg-green-500',
    red: 'bg-red-500'
  }
  return (
    <div className="flex items-center gap-3 px-4">
      <div className={cn("w-2 h-2 rounded-full", colors[color])}></div>
      <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{title} ({count})</h2>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, hint }: { label: string; value: string | number; icon: ComponentType<{ className?: string }>; color: string; hint?: string }) {
  const colors: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600'
  }
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-gray-100 flex items-center gap-5">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm", colors[color])}>
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        {hint && <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-wide">{hint}</p>}
      </div>
    </div>
  )
}

function UserRow({ user, engagementMax, onEdit, onDelete, onResetPassword, onTogglePush }: any) {
  return (
    <tr className="group hover:bg-orange-50/30 transition-colors">
      <td className="px-8 py-5 whitespace-nowrap">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center font-black text-gray-400 border border-gray-100 group-hover:border-orange-200 group-hover:text-orange-500 transition-all">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-black text-gray-900">{user.username}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{getRoleName(user.primaryRole)}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-5">
        <div className="flex flex-wrap gap-1.5">
          {user.user_roles.map((ur: any, i: number) => (
            <span key={i} className={cn(
              "px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
              ur.role === user.primaryRole ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
            )}>
              {getRoleName(ur.role)}
              {ur.role === user.primaryRole && <span className="ml-1">★</span>}
            </span>
          ))}
        </div>
      </td>
      <td className="px-8 py-5">
        <div className="flex flex-wrap gap-1.5">
          {user.user_transports.length > 0 ? user.user_transports.map((ut: any, i: number) => (
            <span key={i} className={cn(
              "px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
              ut.transport === user.primaryTransport ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
            )}>
              {getTransportName(ut.transport)}
              {ut.transport === user.primaryTransport && <span className="ml-1">★</span>}
            </span>
          )) : <span className="text-[10px] font-bold text-gray-300 uppercase italic">Nessuno</span>}
        </div>
      </td>
      <td className="px-8 py-5">
        <ClientAppCell user={user} engagementMax={engagementMax} />
      </td>
      <td className="px-8 py-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePush}
            className={cn(
              "w-10 h-5 rounded-full relative transition-all shadow-inner",
              user.pushNotificationsEnabled ? "bg-orange-500" : "bg-gray-200"
            )}
          >
            <div className={cn(
              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
              user.pushNotificationsEnabled ? "right-1" : "left-1"
            )} />
          </button>
          {user.pushNotificationsEnabled && (
            <div className={cn(
              "w-2 h-2 rounded-full",
              user.push_subscriptions?.length > 0 ? "bg-green-500 animate-pulse" : "bg-yellow-500"
            )} />
          )}
        </div>
      </td>
      <td className="px-8 py-5 text-center">
        <div className="flex items-center justify-center gap-2">
          <ActionBtn icon={Edit} color="blue" onClick={onEdit} />
          <ActionBtn icon={RotateCw} color="orange" onClick={onResetPassword} />
          <ActionBtn icon={Trash} color="red" onClick={onDelete} />
        </div>
      </td>
    </tr>
  )
}

function UserMobileCard({ user, engagementMax, onEdit, onDelete, onResetPassword, onTogglePush }: any) {
  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-gray-100 space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-gray-400">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-black text-gray-900 leading-none">{user.username}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">{getRoleName(user.primaryRole)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ActionBtn icon={Edit} color="blue" onClick={onEdit} size="lg" />
          <ActionBtn icon={Trash} color="red" onClick={onDelete} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Ruoli</p>
          <div className="flex flex-wrap gap-1.5">
            {user.user_roles.map((ur: any, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[9px] font-black rounded-lg uppercase">{getRoleName(ur.role).substring(0,3)}</span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Notifiche Push</p>
          <div className="flex items-center gap-3">
            <Bell className={cn("w-4 h-4", user.pushNotificationsEnabled ? "text-orange-500" : "text-gray-200")} />
            <div className={cn("w-2 h-2 rounded-full", user.push_subscriptions?.length > 0 ? "bg-green-500" : "bg-yellow-500")} />
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-gray-50">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Client app (PWA)</p>
        <ClientAppCell user={user} engagementMax={engagementMax} />
      </div>

      <div className="pt-4 border-t border-gray-50">
        <button 
          onClick={onResetPassword}
          className="w-full py-3 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
        >
          <RotateCw className="h-3 w-3" />
          Reset Password
        </button>
      </div>
    </div>
  )
}

function ActionBtn({ icon: Icon, color, onClick, size = 'md' }: any) {
  const colors: any = {
    blue: 'text-blue-500 bg-blue-50 hover:bg-blue-100',
    orange: 'text-orange-500 bg-orange-50 hover:bg-orange-100',
    red: 'text-red-500 bg-red-50 hover:bg-red-100'
  }
  const sizes: any = {
    md: 'p-2',
    lg: 'p-3'
  }
  return (
    <button
      onClick={onClick}
      className={cn("rounded-xl transition-all active:scale-90", colors[color], sizes[size])}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function UserFormModal({ 
  user, 
  onClose, 
  onSave 
}: { 
  user?: User | null
  onClose: () => void
  onSave: () => void 
}) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    roles: user?.user_roles.map(ur => ur.role) || [],
    primaryRole: user?.primaryRole || '',
    transports: user?.user_transports.map(ut => ut.transport) || [],
    primaryTransport: user?.primaryTransport || '',
    isActive: user?.isActive ?? true,
    trackHours: user?.trackHours ?? true,
    pushNotificationsEnabled: user?.pushNotificationsEnabled ?? true
  })
  const [loading, setLoading] = useState(false)
  const { lightClick, success: successClick, error: errorClick } = useHaptics()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    lightClick()

    try {
      const url = user ? `/api/admin/users/${user.id}` : '/api/admin/users'
      const method = user ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        successClick()
        onSave()
      } else {
        errorClick()
        const error = await response.json()
        alert(error.error || 'Errore durante il salvataggio')
      }
    } catch (error) {
      errorClick()
      console.error('Error saving user:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={user ? 'Modifica Profilo' : 'Nuovo Collaboratore'}
      subtitle={user ? 'Aggiorna i dettagli dell\'account' : 'Crea un nuovo profilo squadra'}
      headerIcon={user ? <Edit className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-8 pt-4">
        {/* Username section */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Nome Utente</label>
          <input
                type="text"
                required
            disabled={!!user}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Es: mario.rossi"
            className="w-full bg-gray-50 border-2 border-gray-100 rounded-[1.5rem] px-6 py-4 text-sm font-black text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all disabled:opacity-50"
          />
        </div>

        {/* Roles section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Abilitazioni & Ruoli</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['ADMIN', 'PIZZAIOLO', 'FATTORINO', 'CUCINA', 'SALA'].map((role) => (
              <label 
                key={role} 
                className={cn(
                  "flex items-center gap-3 p-5 border-2 rounded-[1.5rem] cursor-pointer transition-all",
                  formData.roles.includes(role as Role)
                    ? "bg-orange-50 border-orange-500 shadow-sm"
                    : "bg-white border-gray-50 hover:border-gray-200"
                )}
                onClick={() => lightClick()}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                  formData.roles.includes(role as Role) ? "bg-orange-500 border-orange-500" : "border-gray-200"
                )}>
                  {formData.roles.includes(role as Role) && <Check className="h-3.5 w-3.5 text-white stroke-[4]" />}
                </div>
                    <input
                      type="checkbox"
                  className="hidden"
                      checked={formData.roles.includes(role as Role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                      setFormData({ ...formData, roles: [...formData.roles, role as Role] })
                        } else {
                      setFormData({ ...formData, roles: formData.roles.filter(r => r !== role) })
                        }
                      }}
                    />
                <span className="text-xs font-black text-gray-900 leading-none">{getRoleName(role)}</span>
                  </label>
                ))}
              </div>
            </div>

        {/* Primary Role select */}
        {formData.roles.length > 0 && (
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Ruolo Principale</label>
            <div className="relative group">
              <select
                required
              value={formData.primaryRole}
                onChange={(e) => setFormData({ ...formData, primaryRole: e.target.value as Role })}
                className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-[1.5rem] px-6 py-4 text-sm font-black text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">Seleziona il ruolo principale...</option>
                {formData.roles.map(role => (
                  <option key={role} value={role}>{getRoleName(role)}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90 pointer-events-none group-focus-within:rotate-180 transition-transform" />
            </div>
          </div>
        )}

        {/* Transport section for drivers */}
            {formData.roles.includes('FATTORINO') && (
          <div className="space-y-4 pt-2 animate-in slide-in-from-top-4 duration-300">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Mezzi di Trasporto</label>
                  <div className="flex gap-4">
                    {['AUTO', 'SCOOTER'].map((transport) => (
                <label 
                  key={transport} 
                  className={cn(
                    "flex-1 flex items-center gap-3 p-5 border-2 rounded-[1.5rem] cursor-pointer transition-all",
                    formData.transports.includes(transport as TransportType)
                      ? "bg-blue-50 border-blue-500 shadow-sm"
                      : "bg-white border-gray-50 hover:border-gray-200"
                  )}
                  onClick={() => lightClick()}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    formData.transports.includes(transport as TransportType) ? "bg-blue-500 border-blue-500" : "border-gray-200"
                  )}>
                    {formData.transports.includes(transport as TransportType) && <Check className="h-3.5 w-3.5 text-white stroke-[4]" />}
                  </div>
                        <input
                          type="checkbox"
                    className="hidden"
                          checked={formData.transports.includes(transport as TransportType)}
                          onChange={(e) => {
                            if (e.target.checked) {
                        setFormData({ ...formData, transports: [...formData.transports, transport as TransportType] })
                            } else {
                        setFormData({ ...formData, transports: formData.transports.filter(t => t !== transport) })
                            }
                          }}
                        />
                  <span className="text-xs font-black text-gray-900 leading-none">{getTransportName(transport)}</span>
                      </label>
                    ))}
                </div>

                {formData.transports.length > 1 && (
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Mezzo Preferito</label>
                <div className="relative group">
                  <select
                    required
                    value={formData.primaryTransport}
                    onChange={(e) => setFormData({ ...formData, primaryTransport: e.target.value as TransportType })}
                    className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-[1.5rem] px-6 py-4 text-sm font-black text-gray-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="">Seleziona il mezzo principale...</option>
                    {formData.transports.map(transport => (
                      <option key={transport} value={transport}>{getTransportName(transport)}</option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90 pointer-events-none group-focus-within:rotate-180 transition-transform" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuration Flags */}
        <div className="space-y-4 pt-8 border-t border-gray-100">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Configurazione Account</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: 'isActive', label: 'Collaboratore Attivo', icon: Users, color: 'green' },
              { id: 'trackHours', label: 'Tracciamento Ore', icon: Clock, color: 'blue' },
              { id: 'pushNotificationsEnabled', label: 'Notifiche Push', icon: Bell, color: 'orange' }
            ].map((flag) => (
              <label 
                key={flag.id} 
                className={cn(
                  "flex items-center justify-between p-5 bg-gray-50 rounded-[1.5rem] cursor-pointer hover:bg-white hover:shadow-sm border-2 border-transparent hover:border-gray-100 transition-all",
                  (formData as any)[flag.id] && "bg-white border-gray-50"
                )}
                onClick={() => lightClick()}
              >
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl transition-colors", (formData as any)[flag.id] ? `bg-${flag.color}-50 text-${flag.color}-600` : "bg-gray-200 text-gray-400")}>
                    <flag.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-black text-gray-700 uppercase tracking-tight">{flag.label}</span>
                </div>
                <div className={cn(
                  "w-12 h-6 rounded-full relative transition-all shadow-inner",
                  (formData as any)[flag.id] ? "bg-orange-500" : "bg-gray-300"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                    (formData as any)[flag.id] ? "right-1" : "left-1"
                  )} />
                </div>
                  <input
                    type="checkbox"
                  className="hidden"
                  checked={(formData as any)[flag.id]}
                  onChange={(e) => setFormData({ ...formData, [flag.id]: e.target.checked })}
                />
                </label>
            ))}
          </div>
              </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-gray-50">
          <button
                type="button"
                onClick={onClose}
            className="flex-1 py-5 text-xs font-black uppercase tracking-[0.2em] text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-[1.5rem] transition-all"
              >
                Annulla
          </button>
          <button
                type="submit"
            disabled={loading}
            className="flex-[2] py-5 bg-gradient-primary text-white text-xs font-black uppercase tracking-[0.2em] rounded-[1.5rem] shadow-lg shadow-orange-500/20 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Salvataggio...</span>
            </div>
            ) : (
              'Conferma e Salva'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
