'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BellIcon, MegaphoneIcon, UserCircleIcon } from '@heroicons/react/24/outline'

import CreateFarmModal from '@/components/farm/CreateFarmModal'
import FirstFarmModal from '@/components/farm/FirstFarmModal'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Farm, CreateFarmInput } from '@/types/farm'

interface PendingInvitation {
  email: string
  farmId: string
  role: string
  inviterId: string
  inviterEmail: string
  createdAt: string
  farmName?: string
}

export default function DashboardPage() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [showFirstFarmModal, setShowFirstFarmModal] = useState(false)
  const [firstFarmPrompted, setFirstFarmPrompted] = useState(false)
  const { user, signOut } = useAuth()
  const { showAlert, openDrawer, openModal } = useUI()
  const router = useRouter()

  useEffect(() => {
    loadFarms()
    loadInvitations()
  }, [])

  const loadFarms = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/api/farms')
      setFarms(response.data)
      if (response.data.length === 0) {
        if (!firstFarmPrompted) {
          setShowFirstFarmModal(true)
        }
      } else {
        setShowFirstFarmModal(false)
        setFirstFarmPrompted(true)
      }
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to load farms', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadInvitations = async () => {
    try {
      const response = await apiClient.get('/api/users/me/invitations')
      setInvitations(response.data)
    } catch (error: any) {
      console.error('Failed to load invitations:', error)
    }
  }

  const handleAcceptInvitation = async (farmId: string) => {
    try {
      await apiClient.post(`/api/users/me/invitations/${farmId}/accept`)
      showAlert('Invitation accepted!', 'success')
      await loadFarms()
      await loadInvitations()
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to accept invitation', 'error')
    }
  }

  const handleDeclineInvitation = async (farmId: string) => {
    try {
      await apiClient.post(`/api/users/me/invitations/${farmId}/decline`)
      showAlert('Invitation declined', 'success')
      await loadInvitations()
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to decline invitation', 'error')
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (error: any) {
      showAlert('Failed to sign out', 'error')
    }
  }

  const handleCreateFarm = async (data: CreateFarmInput) => {
    try {
      await apiClient.post('/api/farms', data)
      await loadFarms()
      setIsCreateModalOpen(false)
      setFirstFarmPrompted(true)
      setShowFirstFarmModal(false)
    } catch (error: any) {
      throw error // Let the modal handle the error display
    }
  }

  const handleDismissFirstFarmModal = () => {
    setShowFirstFarmModal(false)
    setFirstFarmPrompted(true)
  }

  const handleOpenCreateFromFirst = () => {
    setFirstFarmPrompted(true)
    setShowFirstFarmModal(false)
    setIsCreateModalOpen(true)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Budbase</h1>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => openDrawer('notifications')}
                  className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                  title="Notifications"
                >
                  <BellIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => openDrawer('userDetails')}
                  className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                  title="Account"
                >
                  <UserCircleIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => openModal('feedback')}
                  className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                  title="Send Feedback"
                >
                  <MegaphoneIcon className="h-5 w-5" />
                </button>
                <span className="hidden sm:inline text-sm text-gray-600">{user?.email}</span>
                <Button onClick={handleSignOut} variant="secondary">
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Pending Invitations</h2>
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <Card key={inv.farmId} className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            You've been invited to <span className="font-bold">{inv.farmName || 'Unknown Farm'}</span>
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Role: <span className="font-semibold">{inv.role}</span> • Invited by {inv.inviterEmail}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptInvitation(inv.farmId)}
                            className="bg-primary text-white hover:bg-primary/90"
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeclineInvitation(inv.farmId)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">My Farms</h2>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Create Farm
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner"></div>
            </div>
          ) : farms.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-gray-600 mb-4">You don't have any farms yet.</p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  Create Your First Farm
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {farms.map((farm) => (
                <Card
                  key={farm.id}
                  onClick={() => router.push(`/farm/${farm.id}`)}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <CardTitle>{farm.name}</CardTitle>
                    {farm.description && (
                      <CardDescription>{farm.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {farm.geolocation && (
                      <p className="text-xs text-gray-500">
                        {farm.geolocation.latitude.toFixed(4)}, {farm.geolocation.longitude.toFixed(4)}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <p className="text-xs text-gray-400">
                      Updated {new Date(farm.updatedAt).toLocaleDateString()}
                    </p>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </main>

        {/* Create Farm Modal */}
        <CreateFarmModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateFarm}
        />
        <FirstFarmModal
          isOpen={showFirstFarmModal}
          onCreate={handleOpenCreateFromFirst}
          onDismiss={handleDismissFirstFarmModal}
          onSignOut={handleSignOut}
        />
      </div>
    </ProtectedRoute>
  )
}

