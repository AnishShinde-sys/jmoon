import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Farm } from '@/types/farm'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'

interface CollaboratorsDrawerProps {
  isOpen: boolean
  farm: Farm | null
  onClose: () => void
}

export default function CollaboratorsDrawer({
  isOpen,
  farm,
  onClose,
}: CollaboratorsDrawerProps) {
  const { drawers, showAlert } = useUI()
  const [inviteEmail, setInviteEmail] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && farm?.users) {
      // Load user details for collaborators
      loadCollaborators()
    }
  }, [isOpen, farm])

  const loadCollaborators = async () => {
    if (!farm?.users) return
    
    try {
      const usersPromises = farm.users.map(async (user) => {
        try {
          const response = await apiClient.get(`/api/users/${user.id}`)
          return response.data
        } catch (error) {
          return { id: user.id, email: 'Unknown' }
        }
      })
      const userData = await Promise.all(usersPromises)
      setUsers(userData)
    } catch (error) {
      console.error('Failed to load collaborators:', error)
    }
  }

  const handleInvite = async () => {
    if (!farm || !inviteEmail.trim()) return
    
    setLoading(true)
    try {
      // Call the invite endpoint which handles both existing users and signups
      const response = await apiClient.post('/api/users/invite', {
        email: inviteEmail,
        farmId: farm.id,
        role: 'Read-only', // Default to Read-only
        farmName: farm.name,
      })

      if (response.data.requiresSignup) {
        showAlert('Signup invitation sent! The user will be added once they create an account.', 'success')
      } else {
        showAlert('Collaborator invited successfully!', 'success')
      }
      
      setInviteEmail('')
      
      // Reload page to refresh data
      window.location.reload()
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to invite collaborator', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = async (userId: string, newPermission: string) => {
    if (!farm) return

    try {
      const updatedPermissions = {
        ...(farm.permissions || {}),
        [userId]: newPermission
      }

      await apiClient.put(`/api/farms/${farm.id}`, {
        permissions: updatedPermissions
      })

      showAlert('Permission updated successfully', 'success')
      
      // Update local state
      const updatedFarm = { ...farm, permissions: updatedPermissions }
      window.location.reload()
    } catch (error: any) {
      showAlert('Failed to update permission', 'error')
    }
  }

  const handleRemove = async (userId: string) => {
    if (!farm) return
    if (!confirm('Are you sure you want to remove this collaborator?')) return

    try {
      const updatedUsers = farm.users?.filter(u => u.id !== userId) || []
      const updatedPermissions = { ...(farm.permissions || {}) }
      delete updatedPermissions[userId]

      await apiClient.put(`/api/farms/${farm.id}`, {
        users: updatedUsers,
        permissions: updatedPermissions
      })

      showAlert('Collaborator removed successfully', 'success')
      window.location.reload()
    } catch (error: any) {
      showAlert('Failed to remove collaborator', 'error')
    }
  }

  if (!isOpen || !drawers.collaborators || !farm) {
    return null
  }

  const permissionOptions = ['Read-only', 'Editor', 'Administrator']

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative bg-white shadow-xl w-full max-w-2xl h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold">Farm Collaborators</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Invite Section */}
          <div className="mb-6 pb-6 border-b">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Invite Collaborator</h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <button
                onClick={handleInvite}
                disabled={loading || !inviteEmail.trim()}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Inviting...' : 'Invite'}
              </button>
            </div>
          </div>

          {/* Collaborators List */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Collaborators</h3>
            
            {users.length === 0 ? (
              <p className="text-sm text-gray-500">No collaborators yet. Invite someone to get started!</p>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <span className="text-yellow-700 font-semibold">
                          {user.email?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.email}</p>
                        <p className="text-xs text-gray-500">
                          {farm.permissions?.[user.id] || 'No permission'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={farm.permissions?.[user.id] || 'Read-only'}
                        onChange={(e) => handlePermissionChange(user.id, e.target.value)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      >
                        {permissionOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRemove(user.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove collaborator"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 mt-6 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

