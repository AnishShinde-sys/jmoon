import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'

interface Statistics {
  users: number
  farms: number
  datasets: number
  date: string
}

export default function AdminPage() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const { showAlert } = useUI()
  const navigate = useNavigate()

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    try {
      const response = await apiClient.get('/api/admin/statistics')
      setStats(response.data)
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to load statistics', 'error')
      // If unauthorized, redirect to dashboard
      if (error.response?.status === 403) {
        navigate('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="card">
                <div className="card-body text-center">
                  <p className="text-4xl font-bold text-primary-600">{stats?.users || 0}</p>
                  <p className="text-sm text-gray-600 mt-2">Total Users</p>
                </div>
              </div>
              <div className="card">
                <div className="card-body text-center">
                  <p className="text-4xl font-bold text-primary-600">{stats?.farms || 0}</p>
                  <p className="text-sm text-gray-600 mt-2">Total Farms</p>
                </div>
              </div>
              <div className="card">
                <div className="card-body text-center">
                  <p className="text-4xl font-bold text-primary-600">{stats?.datasets || 0}</p>
                  <p className="text-sm text-gray-600 mt-2">Total Datasets</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">System Information</h2>
              </div>
              <div className="card-body">
                <p className="text-sm text-gray-600">
                  Statistics last updated: {stats?.date ? new Date(stats.date).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
