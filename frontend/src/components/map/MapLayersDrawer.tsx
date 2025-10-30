"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Map } from 'mapbox-gl'
import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import { useMapContext } from '@/context/MapContext'

const DRAWER_NAME = 'mapLayers'

const baseStyles: Array<{ id: string; label: string; description: string; style: string }> = [
  {
    id: 'satellite',
    label: 'Satellite',
    description: 'High-resolution imagery with road labels.',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
  },
  {
    id: 'streets',
    label: 'Streets',
    description: 'Detailed street map ideal for planning and navigation.',
    style: 'mapbox://styles/mapbox/streets-v12',
  },
  {
    id: 'outdoors',
    label: 'Outdoors',
    description: 'Topographic map with terrain contours and landcover.',
    style: 'mapbox://styles/mapbox/outdoors-v12',
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Low-light friendly dark theme for night work.',
    style: 'mapbox://styles/mapbox/dark-v11',
  },
]

type OverlayKey = 'blocks' | 'blockLabels'

const overlayDefinitions: Record<OverlayKey, { label: string; layers: string[] }> = {
  blocks: {
    label: 'Block polygons',
    layers: ['blocks-layer', 'blocks-layer-outline'],
  },
  blockLabels: {
    label: 'Block labels',
    layers: ['blocks-layer-labels'],
  },
}

function reapplySkyLayer(map: Map) {
  if (!map.getLayer('sky')) {
    map.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 0.0],
        'sky-atmosphere-sun-intensity': 15,
      },
    })
  }
}

export default function MapLayersDrawer() {
  const { drawers, closeDrawer, showAlert } = useUI()
  const { map } = useMapContext()

  const [selectedBaseStyle, setSelectedBaseStyle] = useState<string>(baseStyles[0].id)
  const [terrainEnabled, setTerrainEnabled] = useState(false)
  const [overlayVisibility, setOverlayVisibility] = useState<Record<OverlayKey, boolean>>({
    blocks: true,
    blockLabels: true,
  })

  const terrainEnabledRef = useRef(terrainEnabled)
  const overlayVisibilityRef = useRef(overlayVisibility)

  useEffect(() => {
    terrainEnabledRef.current = terrainEnabled
  }, [terrainEnabled])

  useEffect(() => {
    overlayVisibilityRef.current = overlayVisibility
  }, [overlayVisibility])

  const isOpen = Boolean(drawers[DRAWER_NAME])

  const applyOverlayVisibility = useCallback(
    (key: OverlayKey, visible: boolean, { skipStateUpdate = false }: { skipStateUpdate?: boolean } = {}) => {
      if (!map) return

      if (!map.isStyleLoaded()) {
        map.once('style.load', () => applyOverlayVisibility(key, visible, { skipStateUpdate: true }))
        if (!skipStateUpdate) {
          setOverlayVisibility((prev) => ({ ...prev, [key]: visible }))
        }
        return
      }

      const overlay = overlayDefinitions[key]
      overlay.layers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          try {
            map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
          } catch (error) {
            console.warn(`Unable to set visibility for layer ${layerId}`, error)
          }
        }
      })

      if (!skipStateUpdate) {
        setOverlayVisibility((prev) => ({ ...prev, [key]: visible }))
      }
    },
    [map]
  )

  const applyTerrain = useCallback(
    (enable: boolean, { skipStateUpdate = false }: { skipStateUpdate?: boolean } = {}) => {
      if (!map) return

      if (!map.isStyleLoaded()) {
        map.once('style.load', () => applyTerrain(enable, { skipStateUpdate: true }))
        if (!skipStateUpdate) {
          setTerrainEnabled(enable)
        }
        return
      }

      if (enable) {
        if (!map.getSource('mapbox-dem')) {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14,
          })
        }
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.4 })
        reapplySkyLayer(map)
        map.easeTo({ pitch: Math.max(map.getPitch(), 45), duration: 600 })
      } else {
        map.setTerrain(null)
        if (map.getLayer('sky')) {
          map.removeLayer('sky')
        }
        if (map.getSource('mapbox-dem')) {
          map.removeSource('mapbox-dem')
        }
        map.easeTo({ pitch: 0, duration: 600 })
      }

      if (!skipStateUpdate) {
        setTerrainEnabled(enable)
      }
    },
    [map]
  )

  const handleBaseStyleChange = useCallback(
    (styleId: string) => {
      if (!map) return

      const entry = baseStyles.find((style) => style.id === styleId)
      if (!entry) return

      setSelectedBaseStyle(styleId)

      const reapplyOverlays = () => {
        if (terrainEnabledRef.current) {
          applyTerrain(true, { skipStateUpdate: true })
        }

        (Object.keys(overlayDefinitions) as OverlayKey[]).forEach((key) => {
          const isVisible = overlayVisibilityRef.current[key]
          applyOverlayVisibility(key, isVisible, { skipStateUpdate: true })
        })
      }

      map.once('style.load', reapplyOverlays)
      map.setStyle(entry.style)
    },
    [applyOverlayVisibility, applyTerrain, map]
  )

  const resetView = useCallback(() => {
    if (!map) return
    map.easeTo({ center: map.getCenter(), zoom: 12, pitch: 0, bearing: 0, duration: 800 })
    showAlert('Map view reset to default orientation.', 'info')
  }, [map, showAlert])

  const baseStyleOptions = useMemo(() => baseStyles, [])

  return (
    <Drawer
      isOpen={isOpen}
      title="Map Layers"
      onClose={() => closeDrawer(DRAWER_NAME)}
      position="right"
    >
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Base map</h4>
          <p className="text-xs text-gray-500">Switch between base styles to match your current workflow.</p>
          <div className="mt-3 space-y-2">
            {baseStyleOptions.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                  selectedBaseStyle === option.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="base-style"
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
                  checked={selectedBaseStyle === option.id}
                  onChange={() => handleBaseStyleChange(option.id)}
                />
                <span>
                  <span className="text-sm font-medium text-gray-900">{option.label}</span>
                  <span className="mt-1 block text-xs text-gray-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Terrain</h4>
          <p className="text-xs text-gray-500">Enable 3D terrain to evaluate slope and elevation.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyTerrain(!terrainEnabled)}
              className={`btn btn-sm ${terrainEnabled ? 'btn-primary' : 'btn-secondary'}`}
            >
              {terrainEnabled ? 'Disable terrain' : 'Enable terrain'}
            </button>
            {terrainEnabled && (
              <span className="text-xs text-gray-500">Tilt the map while terrain is enabled for full effect.</span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Overlays</h4>
          <p className="text-xs text-gray-500">Show or hide map layers for clarity while reviewing data.</p>
          <div className="space-y-2">
            {(Object.keys(overlayDefinitions) as OverlayKey[]).map((overlayKey) => {
              const overlay = overlayDefinitions[overlayKey]
              const visible = overlayVisibility[overlayKey]
              return (
                <label key={overlayKey} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-700">{overlay.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                    checked={visible}
                    onChange={() => applyOverlayVisibility(overlayKey, !visible)}
                  />
                </label>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Utilities</h4>
          <button
            onClick={resetView}
            className="btn btn-secondary w-full"
          >
            Reset map view
          </button>
        </div>
      </div>
    </Drawer>
  )
}

