'use client'

import { useState, useEffect, type ComponentType, type FormEvent } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState } from '@/components/ui/list-row'
import { Plus, Edit, Trash2, RotateCcw, Users, X, Bell, Check, Clock, ChevronRight, ShieldCheck, Mail, Star, UserPlus, Trash, RotateCw, ShieldAlert, KeyRound, Copy, Loader2 } from 'lucide-react'
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
import { useToast } from '@/components/ui/toast'

const CLIENT_PRESENCE_STALE_MS = 25 * 60 * 1000

const FLAG_ICON_CLASSES: Record<string, string> = {
  green: 'bg-[var(--pd-success-soft)] text-[var(--pd-success)]',
  blue: 'bg-[var(--pd-accent-soft)] text-[var(--pd-accent)]',
  orange: 'bg-[var(--pd-warning-soft)] text-[var(--pd-warning)]',
}

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

function ClientAppCell({ user }: { user: User }) {
  const p = getClientAppPresence(user)

  const main =
    p.variant === 'none' ? (
      <span className="text-[10px] font-bold text-[var(--pd-muted)]/50 ">—</span>
    ) : p.variant === 'pwa' ? (
      <div className="flex flex-col gap-0.5 max-w-[140px]">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold  text-[var(--pd-success)]">
          <span className="w-2 h-2 shrink-0 animate-pulse rounded-full bg-[var(--pd-success)]" />
          App PWA
        </span>
        <span className="text-[9px] font-medium leading-tight text-[var(--pd-muted)]">
          {formatDistanceToNow(new Date(p.at), { addSuffix: true, locale: localeIt })}
        </span>
      </div>
    ) :     p.variant === 'browser' ? (
      <div className="flex flex-col gap-0.5 max-w-[140px]">
        <span className="text-xs font-semibold text-[var(--pd-accent)]">Browser</span>
        <span className="text-[9px] font-medium leading-tight text-[var(--pd-muted)]">
          {formatDistanceToNow(new Date(p.at), { addSuffix: true, locale: localeIt })}
        </span>
      </div>
    ) : (
      <div className="flex max-w-[160px] flex-col gap-0.5">
        <span className="text-[10px] font-bold text-[var(--pd-muted)]">
          {p.lastMode === 'browser' ? 'Ultimo: browser' : 'Ultimo: app'}
        </span>
        <span className="text-[9px] font-medium leading-tight text-[var(--pd-muted)]" title="Oltre 25 min fa">
          {formatDistanceToNow(new Date(p.at), { addSuffix: true, locale: localeIt })}
        </span>
      </div>
    )

  return (
    <div className="max-w-[220px] space-y-2">
      {main}
      <div className="space-y-1 border-t border-[var(--pd-border)] pt-2 text-[8px] leading-snug text-[var(--pd-muted)]">
        {user.notificationPermissionReported && (
          <p>
            Permesso notif.:{' '}
            <span className="font-bold text-[var(--pd-muted)]">{user.notificationPermissionReported}</span>
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
            <span className="font-bold text-[var(--pd-muted)]">{user.clientPushSubscribedReported ? 'sì' : 'no'}</span>
          </p>
        )}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { showToast, ToastContainer } = useToast()
  const notify = (message: string) => {
    const clean = message.replace(/[✅❌⚠️ℹ️]/g, '').trim()
    const lower = message.toLowerCase()
    const type =
      message.includes('❌') || lower.includes('errore')
        ? 'error'
        : message.includes('⚠️')
          ? 'warning'
          : message.includes('✅') || lower.includes('successo')
            ? 'success'
            : 'info'
    showToast(clean, type as 'success' | 'error' | 'info' | 'warning')
  }

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
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
        } else {
          setUsers(data.users ?? [])
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
        notify('Errore durante l\'eliminazione')
      }
    } catch (error) {
      errorClick()
      console.error('Error deleting user:', error)
      notify('Errore durante l\'eliminazione')
    }
  }

  const openResetPassword = (user: User) => {
    lightClick()
    setResetTarget(user)
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
        notify('Errore durante l\'aggiornamento delle notifiche Push')
      }
    } catch (error) {
      errorClick()
      console.error('Error toggling Push notifications:', error)
      notify('Errore durante l\'aggiornamento delle notifiche Push')
    }
  }

  if (loading) {
    return (
      <MainLayout adminOnly contentWidth="6xl">
        <ToastContainer />
        <div className="pd-page space-y-6">
          <Skeleton className="h-16 rounded-[var(--pd-radius-lg)]" />
          <Skeleton className="h-24 rounded-[var(--pd-radius-lg)]" />
          <TableSkeleton rows={8} cols={6} />
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
    <MainLayout adminOnly contentWidth="6xl">
      <ToastContainer />
      <div className="pd-page pb-16">
        <PageHeader
          dense
          title="Collaboratori"
          subtitle="Profili, ruoli e permessi della squadra"
          action={
            <button
              type="button"
              onClick={() => {
                lightClick()
                setShowCreateForm(true)
              }}
              className="pd-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <UserPlus className="h-4 w-4" />
              Nuovo collaboratore
            </button>
          }
        />

        <StatStrip
          items={[
            { label: 'Push abilitate', value: `${pushEnabledCount}/${activeUsers.length}` },
            { label: 'Dispositivi', value: pushSubscribedCount },
            { label: 'App PWA live', value: `${pwaLiveCount}/${activeUsers.length}` },
            { label: 'Push off', value: activeUsers.length - pushEnabledCount },
          ]}
        />
        {browserLiveCount > 0 && (
          <p className="text-xs" style={{ color: 'var(--pd-muted)' }}>
            In browser (live): {browserLiveCount} — aggiornato dal client ogni pochi minuti
          </p>
        )}

        {/* Active Users Table */}
        <SectionBlock title={`Collaboratori attivi (${activeUsers.length})`} card>
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--pd-surface-muted)', borderBottom: '1px solid var(--pd-border)' }}>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--pd-muted)]">Utente</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--pd-muted)]">Abilitazioni</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--pd-muted)]">Trasporti</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--pd-muted)]">Client app</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--pd-muted)]">Notifiche</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-[var(--pd-muted)]">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--pd-border)]">
                {activeUsers.map(user => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onEdit={() => setEditingUser(user)}
                    onDelete={() => openDeleteConfirm(user)}
                    onResetPassword={() => openResetPassword(user)}
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
                onEdit={() => setEditingUser(user)}
                onDelete={() => openDeleteConfirm(user)}
                onResetPassword={() => openResetPassword(user)}
                onTogglePush={() => togglePushNotifications(user.id, user.pushNotificationsEnabled)}
              />
            ))}
          </div>

          {activeUsers.length === 0 && (
            <EmptyState
              title="Nessun collaboratore attivo"
              icon={<Users className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
            />
          )}
        </SectionBlock>

        {/* Inactive Users Table */}
        {inactiveUsers.length > 0 && (
          <SectionBlock title={`Account disattivati (${inactiveUsers.length})`} card className="opacity-70">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <tbody className="divide-y divide-[var(--pd-border)]">
                  {inactiveUsers.map(user => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onEdit={() => setEditingUser(user)}
                      onDelete={() => openDeleteConfirm(user)}
                      onResetPassword={() => openResetPassword(user)}
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
                  onEdit={() => setEditingUser(user)}
                  onDelete={() => openDeleteConfirm(user)}
                  onResetPassword={() => openResetPassword(user)}
                  onTogglePush={() => togglePushNotifications(user.id, user.pushNotificationsEnabled)}
                />
              ))}
            </div>
          </SectionBlock>
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
            <div className="text-sm font-bold text-[var(--pd-muted)] bg-[var(--pd-surface-muted)] p-4 rounded-2xl border border-[var(--pd-border)]">
              <div className="flex justify-between mb-1"><span>Username:</span> <span className="text-[var(--pd-text)]">{deletingUser.username}</span></div>
              <div className="flex justify-between"><span>Ruolo:</span> <span className="text-[var(--pd-text)]">{getRoleName(deletingUser.primaryRole)}</span></div>
            </div>
          )
        }
      />

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={() => {
            successClick()
          }}
          onError={() => errorClick()}
        />
      )}
    </MainLayout>
  )
}

function UserRow({ user, onEdit, onDelete, onResetPassword, onTogglePush }: any) {
  return (
    <tr className="group hover:bg-[var(--pd-accent-soft)]/30 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--pd-surface-muted)] rounded-xl flex items-center justify-center font-semibold text-[var(--pd-muted)] border border-[var(--pd-border)] group-hover:border-[var(--pd-accent)] group-hover:text-[var(--pd-accent)] transition-all">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--pd-text)]">{user.username}</p>
            <p className="text-[10px] font-bold text-[var(--pd-muted)]">{getRoleName(user.primaryRole)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {user.user_roles.map((ur: any, i: number) => (
            <span key={i} className={cn(
              "px-2.5 py-0.5 rounded-lg text-xs font-semibold",
              ur.role === user.primaryRole ? "bg-[var(--pd-accent-soft)] text-[var(--pd-accent-hover)]" : "bg-[var(--pd-surface-muted)] text-[var(--pd-muted)]"
            )}>
              {getRoleName(ur.role)}
              {ur.role === user.primaryRole && <span className="ml-1">★</span>}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {user.user_transports.length > 0 ? user.user_transports.map((ut: any, i: number) => (
            <span key={i} className={cn(
              "px-2.5 py-0.5 rounded-lg text-xs font-semibold",
              ut.transport === user.primaryTransport ? "bg-[var(--pd-accent-soft)] text-[var(--pd-accent)]" : "bg-[var(--pd-surface-muted)] text-[var(--pd-muted)]"
            )}>
              {getTransportName(ut.transport)}
              {ut.transport === user.primaryTransport && <span className="ml-1">★</span>}
            </span>
          )) : <span className="text-[10px] font-bold text-[var(--pd-muted)]/50 uppercase italic">Nessuno</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <ClientAppCell user={user} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePush}
            className={cn(
              "w-10 h-5 rounded-full relative transition-all shadow-inner",
              user.pushNotificationsEnabled ? "bg-[var(--pd-accent)]" : "bg-[var(--pd-border-strong)]"
            )}
          >
            <div className={cn(
              "absolute top-1 w-3 h-3 bg-[var(--pd-surface)] rounded-full transition-all shadow-sm",
              user.pushNotificationsEnabled ? "right-1" : "left-1"
            )} />
          </button>
          {user.pushNotificationsEnabled && (
            <div className={cn(
              "w-2 h-2 rounded-full",
              user.push_subscriptions?.length > 0 ? "bg-[var(--pd-success)] animate-pulse" : "bg-[var(--pd-warning)]"
            )} />
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <ActionBtn icon={Edit} color="blue" onClick={onEdit} />
          <ActionBtn icon={RotateCw} color="orange" onClick={onResetPassword} />
          <ActionBtn icon={Trash} color="red" onClick={onDelete} />
        </div>
      </td>
    </tr>
  )
}

function UserMobileCard({ user, onEdit, onDelete, onResetPassword, onTogglePush }: any) {
  return (
    <div className="bg-[var(--pd-surface)] rounded-[var(--pd-radius-lg)] p-6 shadow-[var(--pd-shadow)] border border-[var(--pd-border)] space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--pd-surface-muted)] rounded-2xl flex items-center justify-center font-semibold text-[var(--pd-muted)]">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--pd-text)] leading-none">{user.username}</p>
            <p className="text-[10px] font-bold text-[var(--pd-muted)]  mt-1.5">{getRoleName(user.primaryRole)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ActionBtn icon={Edit} color="blue" onClick={onEdit} size="lg" />
          <ActionBtn icon={Trash} color="red" onClick={onDelete} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <p className="text-[9px] font-semibold text-[var(--pd-muted)]/50 ">Ruoli</p>
          <div className="flex flex-wrap gap-1.5">
            {user.user_roles.map((ur: any, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-[var(--pd-surface-muted)] text-[var(--pd-muted)] text-xs font-semibold rounded-lg uppercase">{getRoleName(ur.role).substring(0,3)}</span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] font-semibold text-[var(--pd-muted)]/50 ">Notifiche Push</p>
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4" style={{ color: user.pushNotificationsEnabled ? 'var(--pd-accent)' : 'var(--pd-muted)' }} />
            <div className={cn("w-2 h-2 rounded-full", user.push_subscriptions?.length > 0 ? "bg-[var(--pd-success)]" : "bg-[var(--pd-warning)]")} />
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-[var(--pd-border)]">
        <p className="text-[9px] font-semibold text-[var(--pd-muted)]/50 ">Client app (PWA)</p>
        <ClientAppCell user={user} />
      </div>

      <div className="pt-4 border-t border-[var(--pd-border)]">
        <button 
          onClick={onResetPassword}
          className="w-full py-3 bg-[var(--pd-surface-muted)] hover:bg-[var(--pd-accent-soft)] text-[var(--pd-muted)] hover:text-[var(--pd-accent)] rounded-2xl text-[10px] font-semibold  transition-all flex items-center justify-center gap-2"
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
    blue: 'text-[var(--pd-accent)] bg-[var(--pd-accent-soft)] hover:bg-[var(--pd-accent-soft)]',
    orange: 'text-[var(--pd-accent-hover)] bg-[var(--pd-accent-soft)] hover:bg-[var(--pd-accent-soft)]',
    red: 'text-[var(--pd-danger)] bg-[var(--pd-danger-soft)] hover:bg-[var(--pd-danger-soft)]'
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
  const { showToast } = useToast()
  const notify = (message: string) => {
    const clean = message.replace(/[✅❌⚠️ℹ️]/g, '').trim()
    const lower = message.toLowerCase()
    const type =
      message.includes('❌') || lower.includes('errore')
        ? 'error'
        : message.includes('⚠️')
          ? 'warning'
          : message.includes('✅') || lower.includes('successo')
            ? 'success'
            : 'info'
    showToast(clean, type as 'success' | 'error' | 'info' | 'warning')
  }
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
        notify(error.error || 'Errore durante il salvataggio')
      }
    } catch (error) {
      errorClick()
      console.error('Error saving user:', error)
      notify('Errore durante il salvataggio')
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
          <label className="text-[10px] font-semibold text-[var(--pd-muted)]  ml-1">Nome Utente</label>
          <input
                type="text"
                required
            disabled={!!user}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Es: mario.rossi"
            className="w-full bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-[var(--pd-radius)] px-6 py-4 text-sm font-semibold text-[var(--pd-text)] focus:outline-none focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all disabled:opacity-50"
          />
        </div>

        {/* Roles section */}
        <div className="space-y-4">
          <label className="text-[10px] font-semibold text-[var(--pd-muted)]  ml-1">Abilitazioni & Ruoli</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['ADMIN', 'PIZZAIOLO', 'FATTORINO', 'CUCINA', 'SALA'].map((role) => (
              <label 
                key={role} 
                className={cn(
                  "flex items-center gap-3 p-5 border-2 rounded-[var(--pd-radius)] cursor-pointer transition-all",
                  formData.roles.includes(role as Role)
                    ? "bg-[var(--pd-accent-soft)] border-[var(--pd-accent)] shadow-sm"
                    : "bg-[var(--pd-surface)] border-[var(--pd-border)] hover:border-[var(--pd-border)]"
                )}
                onClick={() => lightClick()}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                  formData.roles.includes(role as Role) ? "bg-[var(--pd-accent)] border-[var(--pd-accent)]" : "border-[var(--pd-border)]"
                )}>
                  {formData.roles.includes(role as Role) && <Check className="h-3.5 w-3.5 stroke-[4]" style={{ color: 'var(--pd-accent-fg)' }} />}
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
                <span className="text-xs font-semibold text-[var(--pd-text)] leading-none">{getRoleName(role)}</span>
                  </label>
                ))}
              </div>
            </div>

        {/* Primary Role select */}
        {formData.roles.length > 0 && (
          <div className="space-y-3">
            <label className="text-[10px] font-semibold text-[var(--pd-muted)]  ml-1">Ruolo Principale</label>
            <div className="relative group">
              <select
                required
              value={formData.primaryRole}
                onChange={(e) => setFormData({ ...formData, primaryRole: e.target.value as Role })}
                className="w-full appearance-none bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-[var(--pd-radius)] px-6 py-4 text-sm font-semibold text-[var(--pd-text)] focus:outline-none focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all cursor-pointer"
              >
                <option value="">Seleziona il ruolo principale...</option>
                {formData.roles.map(role => (
                  <option key={role} value={role}>{getRoleName(role)}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pd-muted)] rotate-90 pointer-events-none group-focus-within:rotate-180 transition-transform" />
            </div>
          </div>
        )}

        {/* Transport section for drivers */}
            {formData.roles.includes('FATTORINO') && (
          <div className="space-y-4 pt-2 animate-in slide-in-from-top-4 duration-300">
            <label className="text-[10px] font-semibold text-[var(--pd-muted)]  ml-1">Mezzi di Trasporto</label>
                  <div className="flex gap-4">
                    {['AUTO', 'SCOOTER'].map((transport) => (
                <label 
                  key={transport} 
                  className={cn(
                    "flex-1 flex items-center gap-3 p-5 border-2 rounded-[var(--pd-radius)] cursor-pointer transition-all",
                    formData.transports.includes(transport as TransportType)
                      ? "bg-[var(--pd-accent-soft)] border-[var(--pd-accent)] shadow-sm"
                      : "bg-[var(--pd-surface)] border-[var(--pd-border)] hover:border-[var(--pd-border)]"
                  )}
                  onClick={() => lightClick()}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    formData.transports.includes(transport as TransportType) ? "bg-[var(--pd-accent)] border-[var(--pd-accent)]" : "border-[var(--pd-border)]"
                  )}>
                    {formData.transports.includes(transport as TransportType) && <Check className="h-3.5 w-3.5 stroke-[4]" style={{ color: 'var(--pd-accent-fg)' }} />}
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
                  <span className="text-xs font-semibold text-[var(--pd-text)] leading-none">{getTransportName(transport)}</span>
                      </label>
                    ))}
                </div>

                {formData.transports.length > 1 && (
              <div className="space-y-3">
                <label className="text-[10px] font-semibold text-[var(--pd-muted)]  ml-1">Mezzo Preferito</label>
                <div className="relative group">
                  <select
                    required
                    value={formData.primaryTransport}
                    onChange={(e) => setFormData({ ...formData, primaryTransport: e.target.value as TransportType })}
                    className="w-full appearance-none bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-[var(--pd-radius)] px-6 py-4 text-sm font-semibold text-[var(--pd-text)] focus:outline-none focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all cursor-pointer"
                  >
                    <option value="">Seleziona il mezzo principale...</option>
                    {formData.transports.map(transport => (
                      <option key={transport} value={transport}>{getTransportName(transport)}</option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pd-muted)] rotate-90 pointer-events-none group-focus-within:rotate-180 transition-transform" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuration Flags */}
        <div className="space-y-4 pt-8 border-t border-[var(--pd-border)]">
          <label className="text-[10px] font-semibold text-[var(--pd-muted)]  ml-1">Configurazione Account</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: 'isActive', label: 'Collaboratore Attivo', icon: Users, color: 'green' },
              { id: 'trackHours', label: 'Tracciamento Ore', icon: Clock, color: 'blue' },
              { id: 'pushNotificationsEnabled', label: 'Notifiche Push', icon: Bell, color: 'orange' }
            ].map((flag) => (
              <label 
                key={flag.id} 
                className={cn(
                  "flex items-center justify-between p-5 bg-[var(--pd-surface-muted)] rounded-[var(--pd-radius)] cursor-pointer hover:bg-[var(--pd-surface)] hover:shadow-sm border-2 border-transparent hover:border-[var(--pd-border)] transition-all",
                  (formData as any)[flag.id] && "bg-[var(--pd-surface)] border-[var(--pd-border)]"
                )}
                onClick={() => lightClick()}
              >
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl transition-colors", (formData as any)[flag.id] ? FLAG_ICON_CLASSES[flag.color] : "bg-[var(--pd-border-strong)] text-[var(--pd-muted)]")}>
                    <flag.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-[var(--pd-text)] uppercase tracking-tight">{flag.label}</span>
                </div>
                <div className={cn(
                  "w-12 h-6 rounded-full relative transition-all shadow-inner",
                  (formData as any)[flag.id] ? "bg-[var(--pd-accent)]" : "bg-[var(--pd-border-strong)]"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-[var(--pd-surface)] rounded-full transition-all shadow-sm",
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
        <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-[var(--pd-border)]">
          <button
                type="button"
                onClick={onClose}
            className="flex-1 py-5 text-xs font-semibold  text-[var(--pd-muted)] hover:text-[var(--pd-muted)] hover:bg-[var(--pd-surface-muted)] rounded-[var(--pd-radius)] transition-all"
              >
                Annulla
          </button>
          <button
                type="submit"
            disabled={loading}
            className="flex-[2] py-5 pd-btn-primary text-xs disabled:opacity-50 active:scale-95"
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

function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
  onError
}: {
  user: User
  onClose: () => void
  onSuccess: () => void
  onError: () => void
}) {
  const [mode, setMode] = useState<'username' | 'custom'>('username')
  const [customPassword, setCustomPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ temporaryPassword: string; username: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const body =
        mode === 'custom'
          ? { newPassword: customPassword.trim() }
          : {}

      if (mode === 'custom' && customPassword.trim().length < 6) {
        setError('La password deve essere di almeno 6 caratteri')
        setLoading(false)
        return
      }

      if (mode === 'username' && user.username.length < 6) {
        setError(
          `Lo username ha meno di 6 caratteri. Imposta una password personalizzata.`
        )
        setLoading(false)
        return
      }

      const response = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        onError()
        setError(data.error || 'Errore durante il reset della password')
        return
      }

      onSuccess()
      setResult({
        temporaryPassword: data.temporaryPassword,
        username: data.username || user.username
      })
    } catch (err) {
      console.error('Error resetting password:', err)
      onError()
      setError('Errore di connessione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const copyPassword = async () => {
    if (!result?.temporaryPassword) return
    await navigator.clipboard.writeText(result.temporaryPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal isOpen onClose={loading ? () => {} : onClose} title="Reset Password">
      {result ? (
        <div className="space-y-6">
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: 'var(--pd-border)', background: 'var(--pd-success-soft)' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--pd-success)', color: 'var(--pd-accent-fg)' }}>
                <Check className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>Password resettata</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--pd-muted)' }}>
                  Comunicare all&apos;utente le credenziali temporanee. Al primo accesso dovrà
                  scegliere una nuova password.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--pd-border)] bg-[var(--pd-surface-muted)] px-4 py-3">
              <p className="text-[10px] font-semibold  text-[var(--pd-muted)] mb-1">
                Username
              </p>
              <p className="text-sm font-semibold text-[var(--pd-text)]">{result.username}</p>
            </div>

            <div className="rounded-2xl border border-[var(--pd-accent)] bg-[var(--pd-accent-soft)] px-4 py-3">
              <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--pd-accent-hover)' }}>
                Password temporanea
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-semibold break-all" style={{ color: 'var(--pd-accent-hover)' }}>
                  {result.temporaryPassword}
                </code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--pd-accent)] text-[10px] font-semibold text-[var(--pd-accent-hover)] hover:bg-[var(--pd-accent-soft)] transition-colors"
                  style={{ background: 'var(--pd-surface)' }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiata' : 'Copia'}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-4 pd-btn-primary text-xs"
          >
            Chiudi
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-[var(--pd-border)] bg-[var(--pd-accent-soft)]/60 p-4 flex gap-3">
            <KeyRound className="h-5 w-5 text-[var(--pd-accent)] shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed" style={{ color: 'var(--pd-accent-hover)' }}>
              Reset password per{' '}
              <span className="font-semibold">{user.username}</span>. L&apos;utente dovrà cambiare la
              password al prossimo accesso.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('username')}
              className={cn(
                'py-3 rounded-xl text-[10px] font-semibold  border transition-all',
                mode === 'username'
                  ? 'bg-[var(--pd-accent)] text-[var(--pd-accent-fg)] border-[var(--pd-accent)]'
                  : 'bg-[var(--pd-surface)] text-[var(--pd-muted)] border-[var(--pd-border)] hover:border-[var(--pd-accent)]'
              )}
            >
              = Username
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={cn(
                'py-3 rounded-xl text-[10px] font-semibold  border transition-all',
                mode === 'custom'
                  ? 'bg-[var(--pd-accent)] text-[var(--pd-accent-fg)] border-[var(--pd-accent)]'
                  : 'bg-[var(--pd-surface)] text-[var(--pd-muted)] border-[var(--pd-border)] hover:border-[var(--pd-accent)]'
              )}
            >
              Personalizzata
            </button>
          </div>

          {mode === 'username' ? (
            <div className="rounded-2xl border border-[var(--pd-border)] bg-[var(--pd-surface-muted)] px-4 py-3">
              <p className="text-[10px] font-semibold  text-[var(--pd-muted)] mb-1">
                Password temporanea
              </p>
              <p className="text-sm font-semibold text-[var(--pd-text)]">{user.username}</p>
              {user.username.length < 6 && (
                <p className="text-[11px] text-[var(--pd-danger)] mt-2 font-medium">
                  Username troppo corto: scegli una password personalizzata (≥ 6 caratteri).
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-semibold  text-[var(--pd-muted)] mb-2">
                Nuova password temporanea
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  autoComplete="new-password"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold  text-[var(--pd-muted)] hover:text-[var(--pd-muted)]"
                >
                  {showPassword ? 'Nascondi' : 'Mostra'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-[var(--pd-danger)] bg-[var(--pd-danger-soft)] border border-[var(--pd-border)] rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-4 text-xs font-semibold  text-[var(--pd-muted)] hover:text-[var(--pd-muted)] hover:bg-[var(--pd-surface-muted)] rounded-[var(--pd-radius)] transition-all disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 pd-btn-primary text-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reset in corso...
                </>
              ) : (
                'Resetta password'
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
