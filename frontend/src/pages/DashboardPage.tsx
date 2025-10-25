import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { Farm } from '@/types/farm'
import apiClient from '@/lib/apiClient'

export default function DashboardPage() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const { user, signOut } = useAuth()
  const { showAlert } = useUI()
  const navigate = useNavigate()

  useEffect(() => {
    loadFarms()
  }, [])

  const loadFarms = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/api/farms')
      setFarms(response.data)
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to load farms', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error: any) {
      showAlert('Failed to sign out', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Budbase</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button onClick={handleSignOut} className="btn btn-secondary">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">My Farms</h2>
          <button className="btn btn-primary">Create Farm</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : farms.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12">
              <p className="text-gray-600 mb-4">You don't have any farms yet.</p>
              <button className="btn btn-primary">Create Your First Farm</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {farms.map((farm) => (
              <div
                key={farm.id}
                onClick={() => navigate(`/farm/${farm.id}`)}
                className="card cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="card-body">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{farm.name}</h3>
                  {farm.description && (
                    <p className="text-sm text-gray-600 mb-4">{farm.description}</p>
                  )}
                  {farm.geolocation && (
                    <p className="text-xs text-gray-500">
                      {farm.geolocation.latitude.toFixed(4)}, {farm.geolocation.longitude.toFixed(4)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Updated {new Date(farm.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
