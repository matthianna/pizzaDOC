'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Plus, Edit, Trash2, RotateCcw, Users, X, Bell, BellOff, Smartphone, Check, Clock, ChevronRight } from 'lucide-react'
import { cn, getRoleName, getTransportName } from '@/lib/utils'
import { Role, TransportType } from '@prisma/client'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'

interface User {
  id: string
  username: string
  isActive: boolean
  trackHours: boolean
  whatsappNotificationsEnabled: boolean
  pushNotificationsEnabled: boolean
  primaryRole: Role
  primaryTransport: TransportType | null
  createdAt: string
  user_roles: { role: Role }[]
  user_transports: { transport: TransportType }[]
  push_subscriptions: { id: string }[]
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const openDeleteConfirm = (user: User) => {
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
        setUsers(users.filter(u => u.id !== userId))
        setShowDeleteConfirm(false)
        setDeletingUser(null)
      } else {
        alert('Errore durante l\'eliminazione')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Errore durante l\'eliminazione')
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Sei sicuro di voler resettare la password di questo utente?')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST'
      })

      if (response.ok) {
        alert('Password resettata con successo. La nuova password è il nome utente.')
      } else {
        alert('Errore durante il reset della password')
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      alert('Errore durante il reset della password')
    }
  }

  const toggleWhatsAppNotifications = async (userId: string, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          whatsappNotificationsEnabled: !currentValue
        })
      })

      if (response.ok) {
        setUsers(users.map(u =>
          u.id === userId
            ? { ...u, whatsappNotificationsEnabled: !currentValue }
            : u
        ))
      } else {
        alert('Errore durante l\'aggiornamento delle notifiche WhatsApp')
      }
    } catch (error) {
      console.error('Error toggling WhatsApp notifications:', error)
      alert('Errore durante l\'aggiornamento delle notifiche WhatsApp')
    }
  }

  const togglePushNotifications = async (userId: string, currentValue: boolean) => {
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
        setUsers(users.map(u =>
          u.id === userId
            ? { ...u, pushNotificationsEnabled: !currentValue }
            : u
        ))
      } else {
        alert('Errore durante l\'aggiornamento delle notifiche Push')
      }
    } catch (error) {
      console.error('Error toggling Push notifications:', error)
      alert('Errore durante l\'aggiornamento delle notifiche Push')
    }
  }

  if (loading) {
    return (
      <MainLayout adminOnly>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <TableSkeleton rows={8} cols={6} />
        </div>
      </MainLayout>
    )
  }

  // ✅ Separa gli utenti attivi da quelli disattivati
  const activeUsers = users.filter(user => user.isActive)
  const inactiveUsers = users.filter(user => !user.isActive)

  const pushEnabledCount = activeUsers.filter(u => u.pushNotificationsEnabled).length
  const pushSubscribedCount = activeUsers.filter(u => u.push_subscriptions?.length > 0).length

  const renderUserCard = (user: User) => (
    <div key={user.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{user.username}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{getRoleName(user.primaryRole)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditingUser(user)}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleResetPassword(user.id)}
            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => openDeleteConfirm(user)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ruoli</p>
          <div className="flex flex-wrap gap-1">
            {user.user_roles.map((ur, i) => (
              <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-bold">
                {getRoleName(ur.role).substring(0, 3)}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Stato</p>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-black uppercase",
            user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {user.isActive ? 'ATTIVO' : 'OFF'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <p className="text-[8px] font-black text-gray-400 uppercase">Notifiche</p>
            <div className="flex items-center gap-3">
              {/* WhatsApp Indicator */}
              <div className="relative">
                <div className={cn(
                  "p-1 rounded-md transition-colors",
                  user.whatsappNotificationsEnabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                )}>
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                {user.whatsappNotificationsEnabled && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white" />
                )}
              </div>

              {/* Push Toggle + Indicator */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => togglePushNotifications(user.id, user.pushNotificationsEnabled)}
                  className={cn(
                    "w-8 h-4 rounded-full relative transition-colors",
                    user.pushNotificationsEnabled ? "bg-orange-500" : "bg-gray-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                    user.pushNotificationsEnabled ? "left-4.5" : "left-0.5"
                  )} />
                </button>
                {user.pushNotificationsEnabled && (
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    user.push_subscriptions?.length > 0 ? "bg-green-500 animate-pulse" : "bg-yellow-500"
                  )} title={user.push_subscriptions?.length > 0 ? "Dispositivo collegato" : "App non ancora aperta/configurata"} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderUserRow = (user: User) => (
    <tr key={user.id} className="hover:bg-gray-50">
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <div className="text-xs sm:text-sm font-medium text-gray-900">
          {user.username}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          {user.user_roles.map((userRole, index) => (
            <span
              key={index}
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${userRole.role === user.primaryRole
                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                : 'bg-blue-100 text-blue-800'
                }`}
            >
              {getRoleName(userRole.role)}
              {userRole.role === user.primaryRole && (
                <span className="ml-1 text-orange-600">★</span>
              )}
            </span>
          ))}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          {user.user_transports.map((userTransport, index) => (
            <span
              key={index}
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${userTransport.transport === user.primaryTransport
                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                : 'bg-green-100 text-green-800'
                }`}
            >
              {getTransportName(userTransport.transport)}
              {userTransport.transport === user.primaryTransport && (
                <span className="ml-1 text-orange-600">★</span>
              )}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-4">
          {/* WhatsApp Status (No toggle anymore, just icon indicator) */}
          <div className="flex items-center gap-1.5" title={user.whatsappNotificationsEnabled ? 'WhatsApp Abilitato' : 'WhatsApp Disabilitato'}>
            <div className={cn(
              "p-1.5 rounded-lg",
              user.whatsappNotificationsEnabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
            )}>
              <Smartphone className="w-4 h-4" />
            </div>
          </div>

          {/* Push Notifications with Device Check */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePushNotifications(user.id, user.pushNotificationsEnabled)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
                user.pushNotificationsEnabled ? "bg-orange-600" : "bg-gray-300"
              )}
              title={user.pushNotificationsEnabled ? 'Push Abilitate' : 'Push Disabilitate'}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  user.pushNotificationsEnabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
            {user.pushNotificationsEnabled && (
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  user.push_subscriptions?.length > 0 ? "bg-green-500 animate-pulse" : "bg-yellow-500"
                )}
                title={user.push_subscriptions?.length > 0 ? 'Configurato correttamente (Dispositivo collegato)' : 'ATTENZIONE: App non ancora aperta sul telefono'}
              />
            )}
          </div>
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isActive
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
            }`}
        >
          {user.isActive ? 'Attivo' : 'Disattivato'}
        </span>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-1 sm:space-x-2">
          <button
            onClick={() => setEditingUser(user)}
            className="text-indigo-600 hover:text-indigo-900"
            title="Modifica"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleResetPassword(user.id)}
            className="text-yellow-600 hover:text-yellow-900"
            title="Reset Password"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => openDeleteConfirm(user)}
            className="text-red-600 hover:text-red-900"
            title="Elimina"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )

  return (
    <MainLayout adminOnly>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-orange-600" />
              Gestione Utenti
            </h1>
            <p className="text-sm sm:text-base text-gray-800 mt-1">
              Gestisci utenti, ruoli e permessi del sistema
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-orange-600 text-white px-3 py-2 text-sm sm:px-4 sm:py-2 rounded-md hover:bg-orange-700 flex items-center justify-center"
          >
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            Nuovo Utente
          </button>
        </div>

        {/* 🔔 Notification Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl shadow-soft border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Bell className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Push Abilitate</p>
              <p className="text-xl font-black text-gray-900">{pushEnabledCount} / {activeUsers.length}</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-soft border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Smartphone className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Dispositivi Collegati</p>
              <p className="text-xl font-black text-gray-900">{pushSubscribedCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-soft border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <BellOff className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Push Disabilitate</p>
              <p className="text-xl font-black text-gray-900">{activeUsers.length - pushEnabledCount}</p>
            </div>
          </div>
        </div>

        {/* Active Users Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <h2 className="text-sm font-semibold text-green-900 flex items-center">
              <span className="inline-block w-2 h-2 bg-green-600 rounded-full mr-2"></span>
              Utenti Attivi ({activeUsers.length})
            </h2>
          </div>
          
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-3 p-4 sm:hidden">
            {activeUsers.map(renderUserCard)}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utente
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ruoli
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trasporti
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notifiche
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeUsers.map(renderUserRow)}
              </tbody>
            </table>
          </div>

          {activeUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700">Nessun utente attivo trovato</p>
            </div>
          )}
        </div>

        {/* Inactive Users Table */}
        {inactiveUsers.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b border-red-100">
              <h2 className="text-sm font-semibold text-red-900 flex items-center">
                <span className="inline-block w-2 h-2 bg-red-600 rounded-full mr-2"></span>
                Utenti Disattivati ({inactiveUsers.length})
              </h2>
            </div>
            
            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-3 p-4 sm:hidden">
              {inactiveUsers.map(renderUserCard)}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utente
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ruoli
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trasporti
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notifiche
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inactiveUsers.map(renderUserRow)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit User Modals would go here */}
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

      {/* Delete User Confirmation Modal */}
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
            <div className="text-sm space-y-1">
              <p><strong>Username:</strong> {deletingUser.username}</p>
              <p><strong>Ruolo:</strong> {getRoleName(deletingUser.primaryRole)}</p>
              <p><strong>Ruoli:</strong> {deletingUser.user_roles.map(r => getRoleName(r.role)).join(', ')}</p>
              <p><strong>Stato:</strong> {deletingUser.isActive ? 'Attivo' : 'Disattivato'}</p>
            </div>
          )
        }
      />
    </MainLayout>
  )
}

// User Form Modal Component
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
    whatsappNotificationsEnabled: user?.whatsappNotificationsEnabled ?? true,
    pushNotificationsEnabled: user?.pushNotificationsEnabled ?? true
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

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
        onSave()
      } else {
        const error = await response.json()
        alert(error.error || 'Errore durante il salvataggio')
      }
    } catch (error) {
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
      headerIcon={user ? <Edit className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-8 pt-4">
        {/* Username section */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nome Utente</label>
          <input
            type="text"
            required
            disabled={!!user}
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Es: mario.rossi"
            className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all disabled:opacity-50"
          />
        </div>

        {/* Roles section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Abilitazioni & Ruoli</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['ADMIN', 'PIZZAIOLO', 'FATTORINO', 'CUCINA', 'SALA'].map((role) => (
              <label 
                key={role} 
                className={cn(
                  "flex items-center gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all",
                  formData.roles.includes(role as Role)
                    ? "bg-orange-50 border-orange-500 shadow-sm"
                    : "bg-white border-gray-100 hover:border-gray-200"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                  formData.roles.includes(role as Role) ? "bg-orange-500 border-orange-500" : "border-gray-200"
                )}>
                  {formData.roles.includes(role as Role) && <Check className="h-3 w-3 text-white stroke-[4]" />}
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
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Ruolo Principale</label>
            <div className="relative">
              <select
                required
                value={formData.primaryRole}
                onChange={(e) => setFormData({ ...formData, primaryRole: e.target.value as Role })}
                className="w-full pl-5 pr-12 py-3 bg-gray-50 border-gray-200 border-2 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 appearance-none transition-all"
              >
                <option value="">Seleziona il ruolo principale...</option>
                {formData.roles.map(role => (
                  <option key={role} value={role}>{getRoleName(role)}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90" />
            </div>
          </div>
        )}

        {/* Transport section for drivers */}
        {formData.roles.includes('FATTORINO') && (
          <div className="space-y-4 pt-2 animate-in slide-in-from-top-4 duration-300">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mezzi di Trasporto</label>
            <div className="flex gap-4">
              {['AUTO', 'SCOOTER'].map((transport) => (
                <label 
                  key={transport} 
                  className={cn(
                    "flex-1 flex items-center gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all",
                    formData.transports.includes(transport as TransportType)
                      ? "bg-blue-50 border-blue-500 shadow-sm"
                      : "bg-white border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    formData.transports.includes(transport as TransportType) ? "bg-blue-500 border-blue-500" : "border-gray-200"
                  )}>
                    {formData.transports.includes(transport as TransportType) && <Check className="h-3 w-3 text-white stroke-[4]" />}
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
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mezzo Preferito</label>
                <div className="relative">
                  <select
                    required
                    value={formData.primaryTransport}
                    onChange={(e) => setFormData({ ...formData, primaryTransport: e.target.value as TransportType })}
                    className="w-full pl-5 pr-12 py-3 bg-gray-50 border-gray-200 border-2 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 appearance-none transition-all"
                  >
                    <option value="">Seleziona il mezzo principale...</option>
                    {formData.transports.map(transport => (
                      <option key={transport} value={transport}>{getTransportName(transport)}</option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuration Flags */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Impostazioni Account</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { id: 'isActive', label: 'Account Attivo', icon: Users, color: 'green' },
              { id: 'trackHours', label: 'Gestione Ore', icon: Clock, color: 'blue' },
              { id: 'whatsappNotificationsEnabled', label: 'Notifiche WA', icon: Smartphone, color: 'green' },
              { id: 'pushNotificationsEnabled', label: 'Notifiche PWA', icon: Bell, color: 'orange' }
            ].map((flag) => (
              <label 
                key={flag.id} 
                className={cn(
                  "flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all",
                  (formData as any)[flag.id] && "ring-1 ring-gray-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl", (formData as any)[flag.id] ? `bg-${flag.color}-100 text-${flag.color}-600` : "bg-gray-200 text-gray-400")}>
                    <flag.icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{flag.label}</span>
                </div>
                <div className={cn(
                  "w-10 h-5 rounded-full relative transition-all",
                  (formData as any)[flag.id] ? "bg-orange-500" : "bg-gray-300"
                )}>
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
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
        <div className="flex gap-3 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] py-4 bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : 'Conferma e Salva'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
