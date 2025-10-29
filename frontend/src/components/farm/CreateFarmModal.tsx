import { useState, useEffect, useRef, FormEvent } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import Modal from '@/components/ui/Modal'
import { CreateFarmInput } from '@/types/farm'
import { useUI } from '@/context/UIContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'

interface CreateFarmModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateFarmInput) => Promise<void>
}

export default function CreateFarmModal({ isOpen, onClose, onSubmit }: CreateFarmModalProps) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const { showAlert } = useUI()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const geocoderRef = useRef<MapboxGeocoder | null>(null)

  // Initialize map when modal opens
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapRef.current) return

    // Set Mapbox access token
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

    // Initialize map
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-122.5, 38.5], // Default center
      zoom: 10,
    })

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add geocoder control for location search
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl as any,
      marker: false, // We'll add our own marker
      zoom: 16,
    })
    map.addControl(geocoder as any)

    // Handle geocoder result
    geocoder.on('result', (e: any) => {
      const [lng, lat] = e.result.center
      addMarker(lat, lng)
    })

    // Handle map click to place marker
    map.on('click', (e) => {
      addMarker(e.lngLat.lat, e.lngLat.lng)
    })

    mapRef.current = map
    geocoderRef.current = geocoder

    // Cleanup
    return () => {
      if (markerRef.current) {
        markerRef.current.remove()
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      geocoderRef.current = null
    }
  }, [isOpen])

  const addMarker = (lat: number, lng: number) => {
    if (!mapRef.current) return

    // Remove existing marker if any
    if (markerRef.current) {
      markerRef.current.remove()
    }

    // Add new marker
    const marker = new mapboxgl.Marker()
      .setLngLat([lng, lat])
      .addTo(mapRef.current)

    markerRef.current = marker

    // Store location
    setLocation({ latitude: lat, longitude: lng })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      showAlert('Farm name is required', 'warning')
      return
    }

    if (!location) {
      showAlert('Please select a location on the map', 'warning')
      return
    }

    try {
      setLoading(true)

      const data: CreateFarmInput = {
        name: name.trim(),
        location: location,
      }

      await onSubmit(data)
      showAlert('Farm created successfully!', 'success')
      handleClose()
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to create farm', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setLocation(null)
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Farm" size="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="farm-name">Farm Name *</Label>
          <Input
            id="farm-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Sunset Vineyard"
          />
        </div>

        <div className="space-y-2">
          <Label>Location *</Label>
          <p className="text-sm text-gray-600 mb-2">
            Click on the map or use the search box to select your farm location
          </p>
          <div
            ref={mapContainerRef}
            className="w-full h-96 rounded-lg border border-gray-300"
            style={{ minHeight: '400px' }}
          />
          {location && (
            <p className="text-xs text-gray-500 mt-2">
              Selected: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            onClick={handleClose}
            disabled={loading}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <span className="flex items-center">
                <span className="spinner mr-2"></span>
                Creating...
              </span>
            ) : (
              'Create Farm'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
