import { useEffect, useRef, useState, memo } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { useMapContext } from '@/context/MapContext'

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
  onBlockClick?: (blockId: string) => void
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
  onBlockClick,
  children,
  vizSettings,
  selectedBlockId = null,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const { map, setMap, draw, setDraw } = useMapContext()

  useEffect(() => {
    if (!mapContainerRef.current || map) return

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
  }, [])

  // Handle blocks data updates - only when blocks change or source doesn't exist
  useEffect(() => {
    if (!map || !map.loaded()) return

    const sourceId = 'blocks'
    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource
    const layerId = 'blocks-layer'

    if (blocks.length === 0) {
      // Remove everything if no blocks
      try {
        if (map.getLayer('blocks-layer-labels')) map.removeLayer('blocks-layer-labels')
        if (map.getLayer('blocks-layer-outline')) map.removeLayer('blocks-layer-outline')
        if (map.getLayer('blocks-layer')) map.removeLayer('blocks-layer')
        if (source) map.removeSource(sourceId)
      } catch (error) {
        // Ignore cleanup errors
      }
      return
    }

    if (source) {
      // Update existing source data
      source.setData({
        type: 'FeatureCollection',
        features: blocks as any,
      })
    } else {
      // Create new source and layers together
      console.log('🚀 Creating source and layers together')
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: blocks as any,
        },
      })

      // Immediately add layers after source is created
      try {
        map.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#6e59c7',
            'fill-opacity': 0.8,
          },
        })

        map.addLayer({
          id: `${layerId}-outline`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#6e59c7',
            'line-width': 3,
            'line-opacity': 1.0,
          },
        })

        console.log('✅ Added block layers with source')

        // Add click handlers
        if (onBlockClick) {
          map.on('click', layerId, (e: any) => {
            const feature = e.features[0]
            if (feature) {
              const blockId = feature.id || feature.properties?.id
              if (blockId) {
                onBlockClick(blockId as string)
              }
            }
          })

          map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer'
          })

          map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = ''
          })
        }
      } catch (error) {
        console.error('Error adding layers with source:', error)
      }
    }
  }, [map, blocks, onBlockClick])


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

    const layerId = 'blocks-layer'
    if (!map.getLayer(layerId)) return

    try {
      map.setPaintProperty(layerId, 'fill-color', debouncedColor)
      map.setPaintProperty(layerId, 'fill-opacity', debouncedOpacity)
      
      if (map.getLayer(`${layerId}-outline`)) {
        map.setPaintProperty(`${layerId}-outline`, 'line-color', debouncedColor)
      }
    } catch (error) {
      // Ignore errors
    }
  }, [map, debouncedColor, debouncedOpacity])

  // Update selection highlight
  useEffect(() => {
    if (!map || !map.loaded()) return

    const layerId = 'blocks-layer'
    const outlineLayerId = `${layerId}-outline`
    if (!map.getLayer(outlineLayerId)) return

    try {
      map.setPaintProperty(outlineLayerId, 'line-width', [
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

  // Handle label visibility
  useEffect(() => {
    if (!map || !map.loaded()) return

    const sourceId = 'blocks'
    const layerId = 'blocks-layer'
    const labelType = vizSettings?.labelBy || 'noLabel'

    if (!map.getSource(sourceId)) return

    try {
      if (labelType === 'noLabel') {
        if (map.getLayer(`${layerId}-labels`)) {
          map.removeLayer(`${layerId}-labels`)
        }
      } else {
        if (!map.getLayer(`${layerId}-labels`)) {
          map.addLayer({
            id: `${layerId}-labels`,
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': ['coalesce', ['get', 'name'], 'Unnamed Block'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 12,
            },
            paint: {
              'text-color': '#333',
              'text-halo-color': '#fff',
              'text-halo-width': 2,
            },
          })
        }
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
      {children}
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default memo(MapContainer)
