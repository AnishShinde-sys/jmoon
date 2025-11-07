import { useCallback, useEffect, useRef, useState, memo } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import * as turf from '@turf/turf'
import { useMapContext } from '@/context/MapContext'

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

const BLOCK_SOURCE_ID = 'blocks'
const BLOCK_LAYER_ID = 'blocks-layer'
const BLOCK_OUTLINE_LAYER_ID = `${BLOCK_LAYER_ID}-outline`
const BLOCK_LABEL_SOURCE_ID = 'block-labels'
const BLOCK_LABEL_LAYER_ID = `${BLOCK_LAYER_ID}-labels`

interface MapContainerProps {
  style?: string
  center?: [number, number]
  zoom?: number
  onLoad?: (map: mapboxgl.Map) => void
  blocks?: any[]
  onBlockSelect?: (blockId: string, feature: any) => void
  onBlockDoubleClick?: (blockId: string, feature: any) => void
  children?: React.ReactNode
  vizSettings?: {
    colorOpacity: number
    blockColor: string
    labelBy: string
  }
  selectedBlockId?: string | null
}

function MapContainer({
  style = 'mapbox://styles/mapbox/satellite-streets-v12',
  center = [-122.5, 38.5],
  zoom = 10,
  onLoad,
  blocks = [],
  onBlockSelect,
  onBlockDoubleClick,
  children,
  vizSettings,
  selectedBlockId = null,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const drawControlRef = useRef<MapboxDraw | null>(null)
  const { map, setMap, draw, setDraw, drawingEnabled } = useMapContext()
  const [tokenMissing, setTokenMissing] = useState(false)
  const blocksBoundsRef = useRef<string | null>(null)

  const getBlockIdentifier = useCallback((feature: any): string | null => {
    if (!feature) return null
    const rawId = feature.id ?? feature.properties?.id ?? feature.properties?.blockId
    if (rawId === undefined || rawId === null) return null
    return String(rawId)
  }, [])

  const buildLabelFeatures = useCallback(
    (features: any[]): any[] => {
      if (!Array.isArray(features)) return []

      const labels: any[] = []
      features.forEach((feature) => {
        const blockId = getBlockIdentifier(feature)
        if (!blockId || !feature?.geometry) return

        try {
          const centroidFeature = turf.centroid(feature as any)
          if (!centroidFeature?.geometry) return

          labels.push({
            type: 'Feature',
            id: `${blockId}-label`,
            geometry: centroidFeature.geometry,
            properties: {
              ...(feature.properties || {}),
              blockId,
            },
          })
        } catch (error) {
          // Ignore features that fail centroid calculation
        }
      })

      return labels
    },
    [getBlockIdentifier]
  )

  if (!mapboxgl.accessToken && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  }

  // Debug token availability
  useEffect(() => {
    console.log('🗺️ Mapbox token check:', {
      accessToken: mapboxgl.accessToken ? 'SET' : 'MISSING',
      envVar: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ? 'SET' : 'MISSING',
      tokenLength: mapboxgl.accessToken?.length || 0,
    })
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || map) return

    if (!mapboxgl.accessToken) {
      console.error('Mapbox access token missing. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable maps.')
      setTokenMissing(true)
      return
    }

    setTokenMissing(false)

    // Initialize map
    const newMap = new mapboxgl.Map({
      container: mapContainerRef.current,
      style,
      center,
      zoom,
    })

    // Add navigation controls
    newMap.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add scale control
    newMap.addControl(new mapboxgl.ScaleControl(), 'bottom-left')

    // Add fullscreen control
    newMap.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    // Handle map load
    newMap.on('load', () => {
      // Remove all label layers to hide landmarks
      const style = newMap.getStyle()
      if (style && style.layers) {
        style.layers.forEach((layer: any) => {
          if (layer.type === 'symbol' || layer.type === 'hillshade') {
            try {
              newMap.removeLayer(layer.id)
            } catch (e) {
              // Layer may not exist, ignore
            }
          }
        })
      }
      
      // Trigger a resize to ensure proper viewport rendering
      setTimeout(() => {
        newMap.resize()
      }, 100)

      const drawControl = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
        defaultMode: 'simple_select',
      })
      drawControlRef.current = drawControl
      newMap.addControl(drawControl as any, 'top-left')
      setDraw(drawControl)
      
      setMap(newMap)
      if (onLoad) onLoad(newMap)
    })

    // Cleanup
    return () => {
      if (drawControlRef.current) {
        try {
          newMap.removeControl(drawControlRef.current as any)
        } catch (error) {
          // ignore cleanup errors
        }
        drawControlRef.current = null
      }
      newMap.remove()
      setMap(null)
      setDraw(null)
    }
  }, []) // Remove dependencies to prevent re-initialization

  useEffect(() => {
    if (!map || !drawControlRef.current) return
    const controlContainer = map.getContainer().querySelector('.mapbox-gl-draw_ctrl-top-left') as HTMLElement | null
    if (!controlContainer) return
    controlContainer.style.display = drawingEnabled ? '' : 'none'
  }, [map, drawingEnabled])

  // Keep persisted farm blocks mirrored inside Mapbox Draw so they can be edited
  useEffect(() => {
    if (!draw || typeof (draw as any).getAll !== 'function') return

    if (!drawingEnabled) {
      try {
        if (typeof (draw as any).deleteAll === 'function') {
          draw.deleteAll()
        }
      } catch (error) {
        console.warn('Failed to clear draw features:', error)
      }
      return
    }

    let persistedCollection: any = null
    try {
      persistedCollection = draw.getAll()
    } catch (error) {
      console.warn('Failed to read persisted draw features:', error)
      return
    }

    const persistedFeatures = Array.isArray(persistedCollection?.features)
      ? persistedCollection.features.filter((feature: any) => feature?.properties?.__persisted)
      : []

    const existingIds = new Set(persistedFeatures.map((feature: any) => String(feature.id)))
    const incomingIds = new Set<string>()

    if (Array.isArray(blocks)) {
      blocks.forEach((feature: any) => {
        if (!feature?.geometry) return
        const blockId = getBlockIdentifier(feature)
        if (!blockId) return

        incomingIds.add(blockId)
        if (!existingIds.has(blockId)) {
          try {
            if (typeof (draw as any).add === 'function') {
              draw.add({
                id: blockId,
                type: 'Feature',
                geometry: feature.geometry,
                properties: {
                  ...feature.properties,
                  __persisted: true,
                },
              } as any)
            }
          } catch (error) {
            console.error('Failed to add block feature to draw:', error)
          }
        } else {
          try {
            if (typeof (draw as any).setFeatureProperty === 'function') {
              draw.setFeatureProperty(blockId, '__persisted', true)
              if (feature?.properties?.fillColor) {
                draw.setFeatureProperty(blockId, 'fillColor', feature.properties.fillColor)
              }
            }
          } catch (error) {
            // Ignore property update errors
          }
        }
      })
    }

    persistedFeatures.forEach((feature: any) => {
      const featureId = String(feature.id)
      if (!incomingIds.has(featureId)) {
        try {
          if (typeof (draw as any).delete === 'function') {
            draw.delete(featureId)
          }
        } catch (error) {
          console.error('Failed to remove stale block feature from draw:', error)
        }
      }
    })
  }, [draw, blocks, getBlockIdentifier, drawingEnabled])

  // Handle blocks data updates - only when blocks change or source doesn't exist
  useEffect(() => {
    if (!map) return

    const applyData = () => {
      const blockSource = map.getSource(BLOCK_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      const labelSource = map.getSource(BLOCK_LABEL_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined

      if (!Array.isArray(blocks) || blocks.length === 0) {
        // Remove everything if no blocks
        try {
          if (map.getLayer(BLOCK_LABEL_LAYER_ID)) map.removeLayer(BLOCK_LABEL_LAYER_ID)
          if (map.getLayer(BLOCK_OUTLINE_LAYER_ID)) map.removeLayer(BLOCK_OUTLINE_LAYER_ID)
          if (map.getLayer(BLOCK_LAYER_ID)) map.removeLayer(BLOCK_LAYER_ID)
          if (labelSource) map.removeSource(BLOCK_LABEL_SOURCE_ID)
          if (blockSource) map.removeSource(BLOCK_SOURCE_ID)
        } catch (error) {
          // Ignore cleanup errors
        }
        return
      }

      const blockFeatureCollection = {
        type: 'FeatureCollection',
        features: blocks as any,
      }

      const labelFeatureCollection = {
        type: 'FeatureCollection',
        features: buildLabelFeatures(blocks),
      }

      if (blockSource) {
        // Update existing source data
        blockSource.setData(blockFeatureCollection as any)
      } else {
        // Create new source and layers together
        console.log('🚀 Creating block sources and layers')
        map.addSource(BLOCK_SOURCE_ID, {
          type: 'geojson',
          data: blockFeatureCollection as any,
        })

        // Immediately add layers after source is created
        try {
          map.addLayer({
            id: BLOCK_LAYER_ID,
            type: 'fill',
            source: BLOCK_SOURCE_ID,
            paint: {
              'fill-color': '#6e59c7',
              'fill-opacity': 0.8,
            },
          })

          map.addLayer({
            id: BLOCK_OUTLINE_LAYER_ID,
            type: 'line',
            source: BLOCK_SOURCE_ID,
            paint: {
              'line-color': '#6e59c7',
              'line-width': 3,
              'line-opacity': 1.0,
            },
          })

        } catch (error) {
          console.error('Error adding layers with source:', error)
        }
      }

      if (labelSource) {
        labelSource.setData(labelFeatureCollection as any)
      } else {
        map.addSource(BLOCK_LABEL_SOURCE_ID, {
          type: 'geojson',
          data: labelFeatureCollection as any,
        })
      }
    }

    if (!map.loaded()) {
      map.once('load', applyData)
      return () => {
        map.off('load', applyData)
      }
    }

    applyData()
  }, [map, blocks, buildLabelFeatures])


  // Debounced values for style updates to prevent flicker
  const [debouncedColor, setDebouncedColor] = useState(vizSettings?.blockColor || '#6e59c7')
  const [debouncedOpacity, setDebouncedOpacity] = useState(vizSettings?.colorOpacity || 0.8)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedColor(vizSettings?.blockColor || '#6e59c7')
      setDebouncedOpacity(vizSettings?.colorOpacity || 0.8)
    }, 50)
    return () => clearTimeout(timer)
  }, [vizSettings?.blockColor, vizSettings?.colorOpacity])

  // Update layer styles - only paint properties, not layer recreation
  useEffect(() => {
    if (!map || !map.loaded()) return

    if (!map.getLayer(BLOCK_LAYER_ID)) return

    try {
      map.setPaintProperty(BLOCK_LAYER_ID, 'fill-color', debouncedColor)
      map.setPaintProperty(BLOCK_LAYER_ID, 'fill-opacity', debouncedOpacity)
      
      if (map.getLayer(BLOCK_OUTLINE_LAYER_ID)) {
        map.setPaintProperty(BLOCK_OUTLINE_LAYER_ID, 'line-color', debouncedColor)
      }
    } catch (error) {
      // Ignore errors
    }
  }, [map, debouncedColor, debouncedOpacity])


  // Update selection highlight
  useEffect(() => {
    if (!map || !map.loaded()) return

    if (!map.getLayer(BLOCK_OUTLINE_LAYER_ID)) return

    try {
      map.setPaintProperty(BLOCK_OUTLINE_LAYER_ID, 'line-width', [
        'case',
        ['==', ['get', 'id'], selectedBlockId || ''],
        5,
        2
      ])
    } catch (error) {
      console.error('Error updating selection:', error)
    }
  }, [map, selectedBlockId])

  // Pointer interactions for block selection
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(BLOCK_LAYER_ID)) return

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    const handleClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feature = e.features?.[0] as any
      const blockId = getBlockIdentifier(feature)
      if (!blockId) return
      e.preventDefault()
      onBlockSelect?.(blockId, feature)
    }

    const handleDoubleClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feature = e.features?.[0] as any
      const blockId = getBlockIdentifier(feature)
      if (!blockId) return
      e.preventDefault()
      if (feature?.geometry) {
        onBlockDoubleClick?.(blockId, feature)
      }
    }

    map.on('mouseenter', BLOCK_LAYER_ID, handleMouseEnter)
    map.on('mouseleave', BLOCK_LAYER_ID, handleMouseLeave)
    map.on('click', BLOCK_LAYER_ID, handleClick)
    map.on('dblclick', BLOCK_LAYER_ID, handleDoubleClick)

    const doubleClickZoom = map.doubleClickZoom
    const wasDoubleClickZoomEnabled = doubleClickZoom.isEnabled()
    if (onBlockDoubleClick && wasDoubleClickZoomEnabled) {
      doubleClickZoom.disable()
    }

    return () => {
      map.off('mouseenter', BLOCK_LAYER_ID, handleMouseEnter)
      map.off('mouseleave', BLOCK_LAYER_ID, handleMouseLeave)
      map.off('click', BLOCK_LAYER_ID, handleClick)
      map.off('dblclick', BLOCK_LAYER_ID, handleDoubleClick)
      if (onBlockDoubleClick && wasDoubleClickZoomEnabled) {
        doubleClickZoom.enable()
      }
    }
  }, [map, blocks, onBlockSelect, onBlockDoubleClick, getBlockIdentifier])

  // Handle label visibility
  useEffect(() => {
    if (!map || !map.loaded()) return

    const labelType = vizSettings?.labelBy || 'noLabel'

    try {
      if (labelType === 'noLabel') {
        if (map.getLayer(BLOCK_LABEL_LAYER_ID)) {
          map.removeLayer(BLOCK_LABEL_LAYER_ID)
        }
        return
      }

      if (!map.getSource(BLOCK_LABEL_SOURCE_ID)) return

      const labelExpression: any =
        labelType === 'headerValue'
          ? ['coalesce', ['get', 'headerValue'], ['get', 'name'], 'Unnamed Block']
          : ['coalesce', ['get', 'name'], 'Unnamed Block']

      if (!map.getLayer(BLOCK_LABEL_LAYER_ID)) {
        map.addLayer({
          id: BLOCK_LABEL_LAYER_ID,
          type: 'symbol',
          source: BLOCK_LABEL_SOURCE_ID,
          layout: {
            'text-field': labelExpression,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'symbol-placement': 'point',
            'text-variable-anchor': ['center'],
            'text-justify': 'center',
          },
          paint: {
            'text-color': '#333',
            'text-halo-color': '#fff',
            'text-halo-width': 2,
          },
        })
      } else {
        map.setLayoutProperty(BLOCK_LABEL_LAYER_ID, 'text-field', labelExpression)
      }
    } catch (error) {
      // Ignore errors
    }
  }, [map, vizSettings?.labelBy])


  useEffect(() => {
    blocksBoundsRef.current = null
  }, [map])

  useEffect(() => {
    if (!map || !map.loaded()) return

    if (!Array.isArray(blocks) || blocks.length === 0) {
      blocksBoundsRef.current = null
      return
    }

    try {
      const collection = {
        type: 'FeatureCollection',
        features: blocks as any,
      }

      const bboxValues = turf.bbox(collection)
      if (!bboxValues || bboxValues.length !== 4) {
        return
      }

      const [minLng, minLat, maxLng, maxLat] = bboxValues as [number, number, number, number]
      if (
        !Number.isFinite(minLng) ||
        !Number.isFinite(minLat) ||
        !Number.isFinite(maxLng) ||
        !Number.isFinite(maxLat)
      ) {
        return
      }

      const serializedBounds = JSON.stringify([minLng, minLat, maxLng, maxLat])
      if (blocksBoundsRef.current === serializedBounds) {
        return
      }

      const hadPriorBounds = blocksBoundsRef.current !== null
      blocksBoundsRef.current = serializedBounds

      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding: 80,
          duration: hadPriorBounds ? 600 : 0,
        }
      )
    } catch (error) {
      console.warn('Failed to auto-fit map to blocks:', error)
    }
  }, [map, blocks])


  return (
    <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0" 
        style={{ width: '100%', height: '100%' }}
      />
      {tokenMissing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/70 p-6 text-center text-sm text-white">
          <div className="space-y-2">
            <p className="font-medium">Mapbox access token missing</p>
            <p className="text-xs text-gray-200">
              Set <code className="rounded bg-gray-800 px-1 py-0.5">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in your environment to enable interactive maps.
            </p>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default memo(MapContainer)
