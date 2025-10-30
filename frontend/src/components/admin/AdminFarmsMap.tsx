'use client'

import { useEffect, useRef } from 'react'
import type { Feature, FeatureCollection } from 'geojson'
import mapboxgl from 'mapbox-gl'

import mapService from '@/lib/mapbox'

const SOURCE_ID = 'admin-farms'
const LAYER_ID = 'admin-farms-layer'

interface AdminFarmsMapProps {
  data: FeatureCollection | Feature | null
}

export default function AdminFarmsMap({ data }: AdminFarmsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = mapService.initializeMap({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [-79, 0],
      zoom: 1,
    })

    map.on('load', () => {
      if (data) {
        mapService.addGeoJSONSource(SOURCE_ID, data)

        mapService.addLayer({
          id: LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': 6,
            'circle-color': '#fbbc04',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#2f3136',
          },
        })

        mapService.fitBounds(data, 100)
      }
    })

    mapRef.current = map

    return () => {
      mapService.cleanup()
      mapRef.current = null
    }
  }, [data])

  useEffect(() => {
    if (!data || !mapRef.current) return

    mapService.addGeoJSONSource(SOURCE_ID, data)

    if (!mapRef.current.getLayer(LAYER_ID)) {
      mapService.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': '#fbbc04',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#2f3136',
        },
      })
    }

    mapService.fitBounds(data, 80)
  }, [data])

  return <div ref={containerRef} className="h-96 w-full rounded-lg" />
}


