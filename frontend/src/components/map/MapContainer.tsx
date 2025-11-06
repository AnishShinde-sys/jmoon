import { useCallback, useEffect, useRef, useState, memo } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import * as turf from '@turf/turf'
import { useMapContext } from '@/context/MapContext'

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
  onDrawCreate?: (e: any) => void
  onDrawUpdate?: (e: any) => void
  onDrawDelete?: (e: any) => void
  enableDrawing?: boolean
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
  onDrawCreate,
  onDrawUpdate,
  onDrawDelete,
  enableDrawing = false,
  blocks = [],
  onBlockSelect,
  onBlockDoubleClick,
  children,
  vizSettings,
  selectedBlockId = null,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const { map, setMap, draw, setDraw } = useMapContext()
  const [tokenMissing, setTokenMissing] = useState(false)

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
      
      setMap(newMap)
      if (onLoad) onLoad(newMap)
    })

    // Cleanup
    return () => {
      newMap.remove()
      setMap(null)
    }
  }, []) // Remove dependencies to prevent re-initialization

  // Keep persisted farm blocks mirrored inside Mapbox Draw so they can be edited
  useEffect(() => {
    if (!draw) return

    const persistedFeatures = draw
      .getAll()
      .features.filter((feature: any) => feature?.properties?.__persisted)

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
            draw.add({
              id: blockId,
              type: 'Feature',
              geometry: feature.geometry,
              properties: {
                ...feature.properties,
                __persisted: true,
              },
            } as any)
          } catch (error) {
            console.error('Failed to add block feature to draw:', error)
          }
        } else {
          try {
            draw.setFeatureProperty(blockId, '__persisted', true)
            if (feature?.properties?.fillColor) {
              draw.setFeatureProperty(blockId, 'fillColor', feature.properties.fillColor)
            }
          } catch (error) {
            // ignore property update errors
          }
        }
      })
    }

    persistedFeatures.forEach((feature: any) => {
      const featureId = String(feature.id)
      if (!incomingIds.has(featureId)) {
        try {
          draw.delete(featureId)
        } catch (error) {
          console.error('Failed to remove stale block feature from draw:', error)
        }
      }
    })
  }, [draw, blocks, getBlockIdentifier])

  // Handle blocks data updates - only when blocks change or source doesn't exist
  useEffect(() => {
    if (!map || !map.loaded()) return

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

        console.log('✅ Added block fill and outline layers')
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

  // Align Mapbox Draw styling with our custom block visualization
  useEffect(() => {
    if (!map) return

    const transparentFillLayers = [
      'gl-draw-polygon-fill',
      'gl-draw-polygon-fill-inactive.cold',
      'gl-draw-polygon-fill-inactive.hot',
      'gl-draw-polygon-fill-active',
    ]

    const legacyOutlineLayers = ['gl-draw-polygon-stroke-inactive', 'gl-draw-polygon-stroke-active']

    const vertexHaloLayers = [
      'gl-draw-polygon-and-line-vertex-halo-active',
      'gl-draw-vertex-outer',
    ]

    const applyStyles = () => {
      transparentFillLayers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'fill-opacity', 0)
        }
      })

      if (map.getLayer('gl-draw-lines')) {
        map.setPaintProperty('gl-draw-lines', 'line-color', debouncedColor)
        map.setPaintProperty('gl-draw-lines', 'line-width', 3)
        map.setPaintProperty('gl-draw-lines', 'line-opacity', 1)
        map.setPaintProperty('gl-draw-lines', 'line-dasharray', [2, 0])
      }

      legacyOutlineLayers.forEach((layerId) => {
        if (!map.getLayer(layerId)) return
        if (layerId === 'gl-draw-polygon-stroke-inactive') {
          map.setPaintProperty(layerId, 'line-opacity', 0)
          return
        }
        map.setPaintProperty(layerId, 'line-color', debouncedColor)
        map.setPaintProperty(layerId, 'line-width', 3)
        map.setPaintProperty(layerId, 'line-opacity', 1)
        map.setPaintProperty(layerId, 'line-dasharray', [2, 0])
      })

      vertexHaloLayers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'circle-radius', 6)
        }
      })

      if (map.getLayer('gl-draw-vertex-inner')) {
        map.setPaintProperty('gl-draw-vertex-inner', 'circle-color', debouncedColor)
      }
    }

    if (map.loaded()) {
      applyStyles()
    } else {
      map.once('idle', applyStyles)
    }

    return () => {
      map.off('idle', applyStyles)
    }
  }, [map, debouncedColor])

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
      console.log('✅ Updated selection highlight')
    } catch (error) {
      console.error('Error updating selection:', error)
    }
  }, [map, selectedBlockId])

  // Sync pointer interactions with Mapbox Draw selection/editing
  useEffect(() => {
    if (!map || !draw) return

    if (!map.getLayer(BLOCK_LAYER_ID)) return

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'move'
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    const handleMouseDown = (e: any) => {
      const feature = e?.features?.[0]
      const blockId = getBlockIdentifier(feature)
      if (!blockId) return
      e.preventDefault()
      try {
        draw.changeMode('direct_select', { featureId: blockId })
      } catch (error) {
        console.error('Failed to enter direct_select mode:', error)
      }
    }

    const handleClick = (e: any) => {
      const feature = e?.features?.[0]
      const blockId = getBlockIdentifier(feature)
      if (!blockId) return
      if (e?.originalEvent?.detail && e.originalEvent.detail > 1) {
        return
      }
      e.preventDefault()
      try {
        draw.changeMode('simple_select', { featureIds: [blockId] })
      } catch (error) {
        console.error('Failed to select block:', error)
      }
      onBlockSelect?.(blockId, feature)
    }

    const handleDoubleClick = (e: any) => {
      const feature = e?.features?.[0]
      const blockId = getBlockIdentifier(feature)
      if (!blockId) return
      e.preventDefault()
      try {
        draw.changeMode('direct_select', { featureId: blockId })
      } catch (error) {
        console.error('Failed to enter edit mode for block:', error)
      }
      if (feature?.geometry) {
        onBlockDoubleClick?.(blockId, feature)
      }
    }

    map.on('mouseenter', BLOCK_LAYER_ID, handleMouseEnter)
    map.on('mouseleave', BLOCK_LAYER_ID, handleMouseLeave)
    map.on('mousedown', BLOCK_LAYER_ID, handleMouseDown)
    map.on('click', BLOCK_LAYER_ID, handleClick)
    map.on('dblclick', BLOCK_LAYER_ID, handleDoubleClick)

    const doubleClickZoom = map.doubleClickZoom
    const wasDoubleClickZoomEnabled = doubleClickZoom.isEnabled()
    if (wasDoubleClickZoomEnabled) {
      doubleClickZoom.disable()
    }

    return () => {
      map.off('mouseenter', BLOCK_LAYER_ID, handleMouseEnter)
      map.off('mouseleave', BLOCK_LAYER_ID, handleMouseLeave)
      map.off('mousedown', BLOCK_LAYER_ID, handleMouseDown)
      map.off('click', BLOCK_LAYER_ID, handleClick)
      map.off('dblclick', BLOCK_LAYER_ID, handleDoubleClick)
      if (wasDoubleClickZoomEnabled) {
        doubleClickZoom.enable()
      }
    }
  }, [map, draw, onBlockSelect, onBlockDoubleClick, getBlockIdentifier])

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


  // Setup drawing controls
  useEffect(() => {
    if (!map) return

    // Create draw control with all controls hidden (we'll use custom buttons)
    const newDraw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: false,
        point: false,
        line_string: false,
        trash: false,
      },
      defaultMode: 'simple_select',
      userProperties: true,
    })

    map.addControl(newDraw as any, 'top-left')
    setDraw(newDraw)

    // Setup event listeners
    if (onDrawCreate) {
      map.on('draw.create', onDrawCreate)
    }
    if (onDrawUpdate) {
      map.on('draw.update', onDrawUpdate)
    }
    if (onDrawDelete) {
      map.on('draw.delete', onDrawDelete)
    }

    return () => {
      if (onDrawCreate) map.off('draw.create', onDrawCreate)
      if (onDrawUpdate) map.off('draw.update', onDrawUpdate)
      if (onDrawDelete) map.off('draw.delete', onDrawDelete)
    }
  }, [map, onDrawCreate, onDrawUpdate, onDrawDelete, setDraw])

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
