'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Feature, FeatureCollection } from 'geojson'

import AdminFarmsMap from '@/components/admin/AdminFarmsMap'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Spinner from '@/components/ui/Spinner'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'
import { downloadUsersCsv, fetchFarmsGeoJson } from '@/services/adminService'

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
  const [geoJson, setGeoJson] = useState<FeatureCollection | Feature | null>(null)
  const [mapLoading, setMapLoading] = useState(true)
  const [mapUpdatedAt, setMapUpdatedAt] = useState<string | null>(null)
  const [downloadingGeoJson, setDownloadingGeoJson] = useState(false)
  const [downloadingUsers, setDownloadingUsers] = useState(false)

  useEffect(() => {
    loadStatistics()
    loadFarmsMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const loadFarmsMap = async () => {
    try {
      setMapLoading(true)
      const response = await fetchFarmsGeoJson()
      setGeoJson(response.geoJson)
      setMapUpdatedAt(response.updatedAt)
    } catch (error: any) {
      console.error('Failed to load farms geojson:', error)
      showAlert(error.response?.data?.message || 'Failed to load farm map data', 'error')
    } finally {
      setMapLoading(false)
    }
  }

  const handleDownloadGeoJson = async () => {
    if (!geoJson) {
      showAlert('Farm GeoJSON not loaded yet. Please try again shortly.', 'warning')
      return
    }

    try {
      setDownloadingGeoJson(true)
      const blob = new Blob([JSON.stringify(geoJson)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'farms.geojson'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      showAlert('Farm GeoJSON downloaded', 'success')
    } catch (error: any) {
      showAlert(error?.message || 'Failed to download GeoJSON', 'error')
    } finally {
      setDownloadingGeoJson(false)
    }
  }

  const handleDownloadUsersCsv = async () => {
    try {
      setDownloadingUsers(true)
      await downloadUsersCsv()
      showAlert('User CSV downloaded', 'success')
    } catch (error: any) {
      showAlert(error?.message || 'Failed to download user CSV', 'error')
    } finally {
      setDownloadingUsers(false)
    }
  }

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

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Farm Distribution</CardTitle>
                  <CardDescription>
                    Global overview of farm locations captured in the latest exports.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mapLoading ? (
                    <div className="flex h-96 items-center justify-center">
                      <Spinner />
                    </div>
                  ) : geoJson ? (
                    <>
                      <AdminFarmsMap data={geoJson} />
                      {mapUpdatedAt && (
                        <p className="mt-4 text-xs text-gray-500">
                          Last updated {new Date(mapUpdatedAt).toLocaleString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex h-32 items-center justify-center text-sm text-gray-500">
                      Unable to load farm map data.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Exports</CardTitle>
                  <CardDescription>Download common GIS and user datasets.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handleDownloadGeoJson}
                    disabled={downloadingGeoJson || !geoJson}
                    className="w-full"
                  >
                    {downloadingGeoJson ? 'Preparing GeoJSON…' : 'Download Farm GeoJSON'}
                  </Button>
                  <Button
                    onClick={handleDownloadUsersCsv}
                    disabled={downloadingUsers}
                    variant="secondary"
                    className="w-full"
                  >
                    {downloadingUsers ? 'Preparing CSV…' : 'Download User Emails CSV'}
                  </Button>
                  <Button onClick={loadFarmsMap} variant="outline" className="w-full">
                    Refresh Map Data
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  )

  return <ProtectedRoute>{content}</ProtectedRoute>
}

