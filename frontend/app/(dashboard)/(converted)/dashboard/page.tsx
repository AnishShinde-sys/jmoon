'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { BellIcon, MegaphoneIcon, UserCircleIcon, MapPinIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

import CreateFarmModal from '@/components/farm/CreateFarmModal'
import FirstFarmModal from '@/components/farm/FirstFarmModal'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Farm, CreateFarmInput } from '@/types/farm'
import { fetchNotifications } from '@/services/userService'

interface PendingInvitation {
  email: string
  farmId: string
  role: string
  inviterId: string
  inviterEmail: string
  createdAt: string
  farmName?: string
}

type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon

interface BlockFeature {
  id?: string
  properties?: {
    updatedAt?: string
    createdAt?: string
    [key: string]: any
  }
  geometry?: GeoJSON.Geometry
}

export default function DashboardPage() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [showFirstFarmModal, setShowFirstFarmModal] = useState(false)
  const [firstFarmPrompted, setFirstFarmPrompted] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const [blockPreviews, setBlockPreviews] = useState<Record<string, PolygonGeometry | null>>({})
  const { user, signOut } = useAuth()
  const { showAlert, openDrawer, openModal } = useUI()
  const router = useRouter()
  const quickActionsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    loadFarms()
    loadInvitations()
    loadNotifications()
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadBlockPreviews = async () => {
      if (!farms.length) {
        setBlockPreviews({})
        return
      }

      try {
        const entries = await Promise.all(
          farms.map(async (farm) => {
            try {
              const response = await apiClient.get(`/api/farms/${farm.id}/blocks`)
              const features: Array<BlockFeature> = Array.isArray(response.data?.features)
                ? response.data.features
                : []

              if (!features.length) {
                return [farm.id, null] as const
              }

              const sorted = [...features].sort((a, b) => {
                const aTime = getFeatureTimestamp(a)
                const bTime = getFeatureTimestamp(b)
                return bTime - aTime
              })

              const latest = sorted[0]
              const geometry = latest?.geometry

              if (isPolygonGeometry(geometry)) {
                return [farm.id, geometry] as const
              }

              return [farm.id, null] as const
            } catch (error) {
              console.error(`Failed to load blocks for farm ${farm.id}:`, error)
              return [farm.id, null] as const
            }
          })
        )

        if (cancelled) {
          return
        }

        const next: Record<string, PolygonGeometry | null> = {}
        for (const [farmId, geometry] of entries) {
          next[farmId] = geometry
        }

        setBlockPreviews(next)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load block previews:', error)
          setBlockPreviews({})
        }
      }
    }

    loadBlockPreviews()

    return () => {
      cancelled = true
    }
  }, [farms])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
        setQuickActionsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setQuickActionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
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

  const loadNotifications = async () => {
    try {
      const notifications = await fetchNotifications()
      setHasUnreadNotifications(notifications.some((notification) => !notification.read))
    } catch (error) {
      console.error('Failed to load notifications:', error)
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
                <div className="hidden sm:flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 shadow-sm">
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Signed in</span>
                    <span className="truncate text-sm font-semibold text-gray-900 max-w-[200px]">{user?.email}</span>
                  </div>
                </div>
                <div className="relative" ref={quickActionsRef}>
                  <button
                    type="button"
                    onClick={() => setQuickActionsOpen((prev) => !prev)}
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                    aria-haspopup="true"
                    aria-expanded={quickActionsOpen}
                  >
                    <Cog6ToothIcon className="h-5 w-5" />
                    <span className="sr-only">Open quick actions</span>
                    {hasUnreadNotifications && (
                      <span className="absolute -top-0.5 -right-0.5 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-blue-500">
                        <span className="sr-only">Unread notifications</span>
                      </span>
                    )}
                  </button>

                  {quickActionsOpen && (
                    <div
                      className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
                      role="menu"
                      aria-label="Quick actions"
                    >
                      <span className="block px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Quick actions
                      </span>
                      <div className="mt-1 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            openDrawer('notifications')
                            setQuickActionsOpen(false)
                            setHasUnreadNotifications(false)
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                          role="menuitem"
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
                            <BellIcon className="h-5 w-5 text-gray-500" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">Notifications</p>
                            <p className="truncate text-xs text-gray-500">View recent alerts</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openDrawer('userSettings')
                            setQuickActionsOpen(false)
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                          role="menuitem"
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
                            <UserCircleIcon className="h-5 w-5 text-gray-500" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">Account</p>
                            <p className="truncate text-xs text-gray-500">Profile & settings</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openModal('feedback')
                            setQuickActionsOpen(false)
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                          role="menuitem"
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
                            <MegaphoneIcon className="h-5 w-5 text-gray-500" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">Send feedback</p>
                            <p className="truncate text-xs text-gray-500">Share product thoughts</p>
                          </div>
                        </button>
                      </div>
                      <div className="my-3 h-px bg-gray-100" />
                      <Button
                        onClick={async () => {
                          setQuickActionsOpen(false)
                          await handleSignOut()
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full justify-center"
                      >
                        Sign Out
                      </Button>
                    </div>
                  )}
                </div>
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
              {farms.map((farm) => {
                const locationLabel = farm.locationName?.trim()
                  ? farm.locationName
                  : farm.geolocation
                  ? `${farm.geolocation.latitude.toFixed(3)}°, ${farm.geolocation.longitude.toFixed(3)}°`
                  : null
                const latestGeometry = blockPreviews[farm.id] ?? null

                return (
                  <Card
                    key={farm.id}
                    onClick={() => router.push(`/farm/${farm.id}`)}
                    className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
                  >
                    <div className="flex h-full flex-col md:flex-row">
                      <div className="flex flex-1 flex-col">
                        <CardHeader className="p-6 pb-4">
                          <CardTitle>{farm.name}</CardTitle>
                          {farm.description && (
                            <CardDescription>{farm.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="px-6 pb-4">
                          {locationLabel && (
                            <p className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPinIcon className="h-4 w-4" />
                              <span>{locationLabel}</span>
                            </p>
                          )}
                        </CardContent>
                        <CardFooter className="mt-auto px-6 pb-6 pt-0">
                          <p className="text-xs text-gray-400">
                            Updated {new Date(farm.updatedAt).toLocaleDateString()}
                          </p>
                        </CardFooter>
                      </div>
                      <div className="relative h-40 w-full overflow-hidden bg-slate-900/5 md:h-auto md:w-1/2">
                        <PolygonPreview geometry={latestGeometry} />
                      </div>
                    </div>
                  </Card>
                )
              })}
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

function getFeatureTimestamp(feature: BlockFeature | undefined): number {
  if (!feature) {
    return 0
  }

  const updatedAt = feature.properties?.updatedAt
  const createdAt = feature.properties?.createdAt
  const updatedTime = updatedAt ? Date.parse(updatedAt) : NaN
  const createdTime = createdAt ? Date.parse(createdAt) : NaN

  if (Number.isFinite(updatedTime)) {
    return updatedTime
  }

  if (Number.isFinite(createdTime)) {
    return createdTime
  }

  return 0
}

function PolygonPreview({ geometry }: { geometry: PolygonGeometry | null }) {
  const mapUrl = useMemo(() => (geometry ? buildStaticMapUrl(geometry) : null), [geometry])

  if (!geometry) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-medium text-slate-500">
        No blocks yet
      </div>
    )
  }

  if (mapUrl) {
    return (
      <div className="relative h-full w-full">
        <img
          src={mapUrl}
          alt="Farm area map preview"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-black/5 to-transparent" aria-hidden="true" />
        <div className="absolute inset-0 border border-white/40 mix-blend-overlay" aria-hidden="true" />
      </div>
    )
  }

  const path = buildPolygonPath(geometry)

  if (!path) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-medium text-slate-500">
        Preview unavailable
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <rect width="100" height="100" rx="8" fill="#f8fafc" />
        <path
          d={path}
          fill="rgba(34,197,94,0.28)"
          stroke="rgba(21,128,61,0.92)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function buildPolygonPath(geometry: PolygonGeometry): string | null {
  const polygon = extractPrimaryPolygon(geometry)

  if (!polygon) {
    return null
  }

  const rings = polygon.coordinates

  if (!rings.length) {
    return null
  }

  const coordinates = rings.reduce<GeoJSON.Position[]>((acc, ring) => {
    acc.push(...ring)
    return acc
  }, [])

  if (!coordinates.length) {
    return null
  }

  const lons = coordinates.map(([lon]) => lon)
  const lats = coordinates.map(([, lat]) => lat)

  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)

  const width = maxLon - minLon
  const height = maxLat - minLat
  const dimension = Math.max(width, height, 0.000001)
  const padding = 12
  const available = 100 - padding * 2
  const scale = available / dimension
  const xPadding = (100 - width * scale) / 2
  const yPadding = (100 - height * scale) / 2

  const path = rings
    .map((ring) => {
      if (!ring.length) {
        return ''
      }

      return (
        ring
          .map(([lon, lat], index) => {
            const x = (lon - minLon) * scale + xPadding
            const y = (maxLat - lat) * scale + yPadding
            const command = index === 0 ? 'M' : 'L'
            return `${command} ${x.toFixed(2)} ${y.toFixed(2)}`
          })
          .join(' ') + ' Z'
      )
    })
    .join(' ')
    .trim()

  return path || null
}

const MAPBOX_STATIC_STYLE = 'mapbox/satellite-streets-v12'
const MAPBOX_STATIC_WIDTH = 600
const MAPBOX_STATIC_HEIGHT = 400
const MAPBOX_STATIC_PADDING = 60
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

function buildStaticMapUrl(geometry: PolygonGeometry): string | null {
  if (!MAPBOX_ACCESS_TOKEN) {
    return null
  }

  const polygon = extractPrimaryPolygon(geometry)

  if (!polygon) {
    return null
  }

  const feature = {
    type: 'Feature',
    properties: {
      stroke: '#15803d',
      'stroke-width': 2,
      'stroke-opacity': 0.9,
      fill: '#4ade80',
      'fill-opacity': 0.35,
    },
    geometry: polygon,
  }

  const geojson = encodeURIComponent(JSON.stringify(feature))
  const query = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    padding: String(MAPBOX_STATIC_PADDING),
    logo: 'false',
    attribution: 'false',
  }).toString()

  return `https://api.mapbox.com/styles/v1/${MAPBOX_STATIC_STYLE}/static/geojson(${geojson})/auto/${MAPBOX_STATIC_WIDTH}x${MAPBOX_STATIC_HEIGHT}@2x?${query}`
}

function extractPrimaryPolygon(geometry: PolygonGeometry): GeoJSON.Polygon | null {
  if (geometry.type === 'Polygon') {
    const coordinates = sanitizePolygonCoordinates(geometry.coordinates)
    return coordinates.length ? { type: 'Polygon', coordinates } : null
  }

  let best: { coords: GeoJSON.Position[][]; area: number } | null = null

  for (const polygon of geometry.coordinates) {
    const coords = sanitizePolygonCoordinates(polygon)
    if (!coords.length || !coords[0]) {
      continue
    }

    const area = Math.abs(calculateRingArea(coords[0]))
    if (!best || area > best.area) {
      best = { coords, area }
    }
  }

  return best ? { type: 'Polygon', coordinates: best.coords } : null
}

function sanitizePolygonCoordinates(polygon: GeoJSON.Position[][]): GeoJSON.Position[][] {
  const rings = polygon
    .map((ring) => sanitizeRing(ring))
    .filter((ring) => ring.length >= 4)

  return rings
}

function sanitizeRing(ring: GeoJSON.Position[]): GeoJSON.Position[] {
  const filtered = ring.filter((position) => isValidPosition(position)) as GeoJSON.Position[]

  if (filtered.length < 3) {
    return []
  }

  const sanitized = filtered.map(([lon, lat]) => [roundCoord(lon), roundCoord(lat)] as GeoJSON.Position)
  const first = sanitized[0]
  const last = sanitized[sanitized.length - 1]

  if (Math.abs(first[0] - last[0]) > 1e-6 || Math.abs(first[1] - last[1]) > 1e-6) {
    sanitized.push([first[0], first[1]] as GeoJSON.Position)
  }

  return sanitized.length >= 4 ? sanitized : []
}

function isValidPosition(position: unknown): position is GeoJSON.Position {
  if (!Array.isArray(position) || position.length < 2) {
    return false
  }

  const [lon, lat] = position
  return Number.isFinite(lon) && Number.isFinite(lat)
}

function roundCoord(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : value
}

function calculateRingArea(ring: GeoJSON.Position[]): number {
  if (ring.length < 4) {
    return 0
  }

  let sum = 0

  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    sum += x1 * y2 - x2 * y1
  }

  return sum / 2
}

function isPolygonGeometry(geometry: GeoJSON.Geometry | undefined | null): geometry is PolygonGeometry {
  if (!geometry) {
    return false
  }

  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'
}

