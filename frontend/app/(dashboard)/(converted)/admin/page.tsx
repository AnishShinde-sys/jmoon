'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Statistics {
  users: number
  farms: number
  datasets: number
  date: string
}

export default function AdminPage() {
  const router = useRouter()
  const { showAlert } = useUI()
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStatistics = async () => {
      try {
        const response = await apiClient.get('/api/admin/statistics')
        setStats(response.data)
      } catch (error: any) {
        showAlert(error?.response?.data?.message || 'Failed to load statistics', 'error')
        if (error?.response?.status === 403) {
          router.replace('/dashboard')
        }
      } finally {
        setLoading(false)
      }
    }

    loadStatistics()
  }, [router, showAlert])

  const content = (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <Button onClick={() => router.push('/dashboard')} variant="secondary">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="text-center pt-6">
                  <p className="text-4xl font-bold text-primary-600">{stats?.users ?? 0}</p>
                  <p className="text-sm text-gray-600 mt-2">Total Users</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center pt-6">
                  <p className="text-4xl font-bold text-primary-600">{stats?.farms ?? 0}</p>
                  <p className="text-sm text-gray-600 mt-2">Total Farms</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center pt-6">
                  <p className="text-4xl font-bold text-primary-600">{stats?.datasets ?? 0}</p>
                  <p className="text-sm text-gray-600 mt-2">Total Datasets</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Statistics last updated:{' '}
                  {stats?.date ? new Date(stats.date).toLocaleString() : 'N/A'}
                </CardDescription>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )

  return <ProtectedRoute>{content}</ProtectedRoute>
}

