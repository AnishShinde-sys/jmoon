'use client'

import { useState } from 'react'
import { GlobeAltIcon } from '@heroicons/react/24/outline'

import { useMapContext } from '@/context/MapContext'

const DEM_SOURCE_ID = 'mapbox-dem'
const SKY_LAYER_ID = 'sky'

export default function TerrainToggle() {
  const { map } = useMapContext()
  const [enabled, setEnabled] = useState(false)
  const toggleTerrain = () => {
    if (!map) return

    if (!enabled) {
      if (!map.getSource(DEM_SOURCE_ID)) {
        map.addSource(DEM_SOURCE_ID, {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        })
      }
      map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: 1.3 })

      if (!map.getLayer(SKY_LAYER_ID)) {
        map.addLayer({
          id: SKY_LAYER_ID,
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 0.0],
            'sky-atmosphere-sun-intensity': 15,
          },
        })
      }

      map.easeTo({ pitch: 60, duration: 1200 })
      setEnabled(true)
    } else {
      map.setTerrain(null)
      if (map.getLayer(SKY_LAYER_ID)) {
        map.removeLayer(SKY_LAYER_ID)
      }
      if (map.getSource(DEM_SOURCE_ID)) {
        map.removeSource(DEM_SOURCE_ID)
      }
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 })
      setEnabled(false)
    }
  }

  return (
    <button
      onClick={toggleTerrain}
      className="flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 shadow-md transition hover:bg-white"
    >
      <GlobeAltIcon className="h-4 w-4" /> {enabled ? 'Disable Terrain' : 'Enable Terrain'}
    </button>
  )
}
