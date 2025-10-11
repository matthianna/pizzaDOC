'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Plus, Edit, Trash2, RotateCcw, Users, X } from 'lucide-react'
import { getRoleName, getTransportName } from '@/lib/utils'
import { Role, TransportType } from '@prisma/client'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

interface User {
  id: string
  username: string
  isActive: boolean
  primaryRole: Role
  primaryTransport: TransportType | null
  createdAt: string
  user_roles: { role: Role }[]
  user_transports: { transport: TransportType }[]
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

  if (loading) {
    return (
      <MainLayout adminOnly>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </MainLayout>
    )
  }

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

        {/* Users Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
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
                    Stato
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
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
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            userRole.role === user.primaryRole
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
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            userTransport.transport === user.primaryTransport
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
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isActive
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
              ))}
            </tbody>
          </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700">Nessun utente trovato</p>
            </div>
          )}
        </div>
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
    isActive: user?.isActive ?? true
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
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {user ? 'Modifica Utente' : 'Nuovo Utente'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!user && (
              <Input
                label="Nome utente"
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Inserisci il nome utente"
              />
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Ruoli
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['ADMIN', 'FATTORINO', 'CUCINA', 'SALA'].map((role) => (
                  <label key={role} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(role as Role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            roles: [...formData.roles, role as Role]
                          })
                        } else {
                          setFormData({
                            ...formData,
                            roles: formData.roles.filter(r => r !== role)
                          })
                        }
                      }}
                      className="mr-3 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-900">{getRoleName(role)}</span>
                  </label>
                ))}
              </div>
            </div>

            <Select
              label="Ruolo principale"
              options={[
                { value: '', label: 'Seleziona ruolo' },
                ...formData.roles.map(role => ({
                  value: role,
                  label: getRoleName(role)
                }))
              ]}
              value={formData.primaryRole}
              onChange={(value) => setFormData({ ...formData, primaryRole: value as Role })}
            />

            {formData.roles.includes('FATTORINO') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Mezzi di trasporto
                  </label>
                  <div className="flex gap-4">
                    {['AUTO', 'SCOOTER'].map((transport) => (
                      <label key={transport} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex-1">
                        <input
                          type="checkbox"
                          checked={formData.transports.includes(transport as TransportType)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                transports: [...formData.transports, transport as TransportType]
                              })
                            } else {
                              setFormData({
                                ...formData,
                                transports: formData.transports.filter(t => t !== transport)
                              })
                            }
                          }}
                          className="mr-3 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-900">{getTransportName(transport)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {formData.transports.length > 1 && (
                  <Select
                    label="Mezzo principale"
                    options={[
                      { value: '', label: 'Seleziona mezzo' },
                      ...formData.transports.map(transport => ({
                        value: transport,
                        label: getTransportName(transport)
                      }))
                    ]}
                    value={formData.primaryTransport}
                    onChange={(value) => setFormData({ ...formData, primaryTransport: value as TransportType })}
                  />
                )}
              </>
            )}

            {user && (
              <div className="pt-2">
                <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mr-3 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-900">Utente attivo</span>
                </label>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                isLoading={loading}
              >
                Salva
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
