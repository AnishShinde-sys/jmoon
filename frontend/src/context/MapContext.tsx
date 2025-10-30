'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type * as mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { Dataset } from '@/types/dataset'
import { LaunchOptions } from '@/components/datasets/DatasetLaunchConfirmModal'
import apiClient from '@/lib/apiClient'

interface MapContextType {
  map: mapboxgl.Map | null
  setMap: (map: mapboxgl.Map | null) => void
  draw: MapboxDraw | null
  setDraw: (draw: MapboxDraw | null) => void
  drawingEnabled: boolean
  setDrawingEnabled: (enabled: boolean) => void
  activeDataset: Dataset | null
  setActiveDataset: (dataset: Dataset | null) => void
}

const MapContext = createContext<MapContextType | undefined>(undefined)

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const [draw, setDraw] = useState<MapboxDraw | null>(null)
  const [drawingEnabled, setDrawingEnabled] = useState(false)
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null)

  // Handle dataset launch events
  useEffect(() => {
    const handleLaunchDataset = async (event: CustomEvent) => {
      const detail = event.detail as { dataset?: Dataset; options?: LaunchOptions } | Dataset
      const dataset = (detail as any)?.dataset ? (detail as any).dataset : (detail as Dataset)
      const options: LaunchOptions = (detail as any)?.options || {
        autoZoom: true,
        clearExistingLayers: false,
        openDetails: false,
      }

      if (!dataset) {
        console.warn('launchDataset event missing dataset payload')
        return
      }
      
      if (!map) {
        console.warn('Map not initialized, cannot launch dataset')
        return
      }

      try {
        // Clear existing dataset layers if requested
        if (options.clearExistingLayers) {
          clearDatasetLayers()
        }

        // Load dataset with GeoJSON
        const response = await apiClient.get(`/api/datasets/${dataset.id}`, {
          params: { farmId: dataset.farmId },
        })

        const datasetWithGeojson = response.data
        if (datasetWithGeojson.geojson) {
          await renderDatasetOnMap(datasetWithGeojson, options)
          setActiveDataset(datasetWithGeojson)
        } else {
          console.warn('Dataset has no GeoJSON data to render')
        }
      } catch (error) {
        console.error('Failed to launch dataset:', error)
      }
    }

    const handleClearDatasetLayers = () => {
      clearDatasetLayers()
    }

    window.addEventListener('launchDataset', handleLaunchDataset as EventListener)
    window.addEventListener('clearDatasetLayers', handleClearDatasetLayers)

    return () => {
      window.removeEventListener('launchDataset', handleLaunchDataset as EventListener)
      window.removeEventListener('clearDatasetLayers', handleClearDatasetLayers)
    }
  }, [map])

  const clearDatasetLayers = () => {
    if (!map) return

    // Remove dataset layers
    const layersToRemove = ['dataset-points', 'dataset-heatmap', 'dataset-polygons']
    layersToRemove.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
    })

    // Remove dataset sources
    const sourcesToRemove = ['dataset-source']
    sourcesToRemove.forEach((sourceId) => {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }
    })

    setActiveDataset(null)
  }

  const renderDatasetOnMap = async (dataset: Dataset & { geojson: any }, options: LaunchOptions) => {
    if (!map || !dataset.geojson) return

    const sourceId = 'dataset-source'
    const layerId = 'dataset-points'

    // Add or update source
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(dataset.geojson)
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: dataset.geojson,
      })
    }

    // Add layer if it doesn't exist
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': '#ff6b6b',
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add click handler for data points
      map.on('click', layerId, (e) => {
        const feature = e.features?.[0]
        if (feature) {
          // Dispatch event for data point click
          window.dispatchEvent(
            new CustomEvent('dataPointClick', {
              detail: { feature, dataset },
            })
          )
        }
      })

      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = ''
      })
    }

    // Auto-zoom if requested
    if (options.autoZoom && dataset.geojson.features.length > 0) {
      try {
        const bounds = new mapboxgl.LngLatBounds()
        dataset.geojson.features.forEach((feature: any) => {
          if (feature.geometry.type === 'Point') {
            bounds.extend(feature.geometry.coordinates)
          }
        })
        map.fitBounds(bounds, { padding: 50, duration: 1000 })
      } catch (error) {
        console.warn('Failed to auto-zoom to dataset:', error)
      }
    }
  }

  const value = {
    map,
    setMap,
    draw,
    setDraw,
    drawingEnabled,
    setDrawingEnabled,
    activeDataset,
    setActiveDataset,
  }

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>
}

export function useMapContext() {
  const context = useContext(MapContext)
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider')
  }
  return context
}
