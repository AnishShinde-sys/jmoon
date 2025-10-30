'use client'

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import mapboxgl, { MapMouseEvent } from 'mapbox-gl'
import type { Feature, FeatureCollection, Geometry } from 'geojson'

import MapboxDraw from '@mapbox/mapbox-gl-draw'

import { Dataset } from '@/types/dataset'
import { LaunchOptions } from '@/components/datasets/DatasetLaunchConfirmModal'
import apiClient from '@/lib/apiClient'
import { useUI } from '@/context/UIContext'

const DATASET_SOURCE_ID = 'dataset-source'
const DATASET_POINT_LAYER_ID = 'dataset-points'
const DATASET_POLYGON_LAYER_ID = 'dataset-polygons'
const DATASET_POLYGON_OUTLINE_LAYER_ID = 'dataset-polygons-outline'
const DATASET_HEATMAP_LAYER_ID = 'dataset-heatmap'
const DATASET_HIGHLIGHT_SOURCE_ID = 'dataset-highlight-source'
const DATASET_HIGHLIGHT_POINT_LAYER_ID = 'dataset-highlight-point'
const DATASET_HIGHLIGHT_POLYGON_LAYER_ID = 'dataset-highlight-polygon'

const DEFAULT_COLORS = [
  '#6e59c7',
  '#f97316',
  '#0ea5e9',
  '#22c55e',
  '#facc15',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
]

interface LegendEntry {
  color: string
  label: string
  min?: number
  max?: number
}

interface MapLegend {
  title?: string
  mode: 'single' | 'category' | 'range'
  entries: LegendEntry[]
  min?: number
  max?: number
}

type DatasetHandlers = {
  pointClick?: (event: MapMouseEvent) => void
  polygonClick?: (event: MapMouseEvent) => void
}

interface MapContextType {
  map: mapboxgl.Map | null
  setMap: (map: mapboxgl.Map | null) => void
  draw: MapboxDraw | null
  setDraw: (draw: MapboxDraw | null) => void
  drawingEnabled: boolean
  setDrawingEnabled: (enabled: boolean) => void
  activeDataset: Dataset | null
  setActiveDataset: (dataset: Dataset | null) => void
  legend: MapLegend | null
}

const MapContext = createContext<MapContextType | undefined>(undefined)

const isPolygonGeometry = (geometry: Geometry | null | undefined) => {
  if (!geometry) return false
  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'
}

const isPointGeometry = (geometry: Geometry | null | undefined) => {
  if (!geometry) return false
  return geometry.type === 'Point' || geometry.type === 'MultiPoint'
}

const extractNumericValues = (features: Feature[], property: string) => {
  const values: number[] = []
  features.forEach((feature) => {
    const raw = feature.properties?.[property]
    const value = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
    if (!Number.isNaN(value)) {
      values.push(value)
    }
  })
  return values
}

const computeEqualBreaks = (values: number[], classes: number) => {
  if (!values.length || classes <= 1) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return []
  const interval = (max - min) / classes
  const stops: number[] = []
  for (let i = 1; i < classes; i += 1) {
    stops.push(min + interval * i)
  }
  return stops
}

const computeQuantileBreaks = (values: number[], classes: number) => {
  if (!values.length || classes <= 1) return []
  const sorted = [...values].sort((a, b) => a - b)
  const stops: number[] = []
  for (let i = 1; i < classes; i += 1) {
    const position = (sorted.length - 1) * (i / classes)
    const base = Math.floor(position)
    const rest = position - base
    const value =
      rest === 0
        ? sorted[base]
        : sorted[base] + rest * (sorted[Math.min(base + 1, sorted.length - 1)] - sorted[base])
    stops.push(value)
  }
  return stops
}

const computeJenksBreaks = (values: number[], classes: number) => {
  if (!values.length || classes <= 1) return []
  const sorted = [...values].sort((a, b) => a - b)
  const nClasses = Math.min(classes, sorted.length)
  const mat1: number[][] = []
  const mat2: number[][] = []
  for (let i = 0; i <= sorted.length; i += 1) {
    mat1.push(new Array(nClasses + 1).fill(0))
    mat2.push(new Array(nClasses + 1).fill(0))
  }
  for (let i = 1; i <= nClasses; i += 1) {
    mat1[0][i] = 1
    mat2[0][i] = 0
    for (let j = 1; j <= sorted.length; j += 1) {
      mat2[j][i] = Infinity
    }
  }
  for (let l = 1; l <= sorted.length; l += 1) {
    let s1 = 0
    let s2 = 0
    let w = 0
    for (let m = 1; m <= l; m += 1) {
      const i3 = l - m + 1
      const val = sorted[i3 - 1]
      s2 += val * val
      s1 += val
      w += 1
      const variance = s2 - (s1 * s1) / w
      if (i3 !== 1) {
        for (let j = 2; j <= nClasses; j += 1) {
          if (mat2[l][j] >= variance + mat2[i3 - 1][j - 1]) {
            mat1[l][j] = i3
            mat2[l][j] = variance + mat2[i3 - 1][j - 1]
          }
        }
      }
    }
    mat1[l][1] = 1
    mat2[l][1] = s2 - (s1 * s1) / w
  }
  const breaks: number[] = []
  let k = sorted.length
  for (let j = nClasses; j >= 2; j -= 1) {
    const id = mat1[k][j] - 1
    breaks.unshift(sorted[id])
    k = mat1[k][j] - 1
  }
  return breaks
}

const computeBreaks = (values: number[], method: string | undefined, zones: number | undefined) => {
  const classes = Math.max(1, zones || 5)
  switch (method) {
    case 'jenks':
      return computeJenksBreaks(values, classes)
    case 'quantile':
      return computeQuantileBreaks(values, classes)
    case 'equal':
    default:
      return computeEqualBreaks(values, classes)
  }
}

const buildValueExpression = (property: string, breaks: number[], colors: string[]) => {
  const palette = [...colors]
  while (palette.length < breaks.length + 1) {
    palette.push(DEFAULT_COLORS[palette.length % DEFAULT_COLORS.length])
  }
  const expression: any[] = ['step', ['to-number', ['get', property]], palette[0]]
  breaks.forEach((stop, index) => {
    expression.push(stop, palette[index + 1])
  })
  return expression
}

const buildCategoryExpression = (property: string, categories: string[], colors: string[]) => {
  const palette = [...colors]
  while (palette.length < categories.length + 1) {
    palette.push(DEFAULT_COLORS[palette.length % DEFAULT_COLORS.length])
  }
  const expression: any[] = ['match', ['get', property]]
  categories.forEach((category, index) => {
    expression.push(category, palette[index])
  })
  expression.push(palette[categories.length] ?? DEFAULT_COLORS[0])
  return expression
}

const computeBounds = (geojson: FeatureCollection): mapboxgl.LngLatBounds | null => {
  const bounds = new mapboxgl.LngLatBounds()
  let hasCoordinates = false
  const addCoords = (coords: any) => {
    if (Array.isArray(coords[0])) {
      coords.forEach((coord: any) => addCoords(coord))
    } else if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      bounds.extend(coords as [number, number])
      hasCoordinates = true
    }
  }

  geojson.features.forEach((feature) => {
    const { geometry } = feature
    if (!geometry) return
    if (geometry.type === 'GeometryCollection') {
      (geometry.geometries || []).forEach((geom) => addCoords((geom as any).coordinates))
    } else {
      addCoords((geometry as any).coordinates)
    }
  })

  return hasCoordinates ? bounds : null
}

const getDatasetHandlers = (map: mapboxgl.Map): DatasetHandlers => {
  const handlers = (map as any).__datasetHandlers
  if (handlers) return handlers as DatasetHandlers
  const initial: DatasetHandlers = {}
  ;(map as any).__datasetHandlers = initial
  return initial
}

const ensureHighlightLayers = (map: mapboxgl.Map) => {
  if (!map.getSource(DATASET_HIGHLIGHT_SOURCE_ID)) {
    map.addSource(DATASET_HIGHLIGHT_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    })
  }

  if (!map.getLayer(DATASET_HIGHLIGHT_POINT_LAYER_ID)) {
    map.addLayer({
      id: DATASET_HIGHLIGHT_POINT_LAYER_ID,
      type: 'circle',
      source: DATASET_HIGHLIGHT_SOURCE_ID,
      paint: {
        'circle-radius': 10,
        'circle-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#111827',
        'circle-opacity': 0.95,
      },
      filter: ['==', ['geometry-type'], 'Point'],
    })
  }

  if (!map.getLayer(DATASET_HIGHLIGHT_POLYGON_LAYER_ID)) {
    map.addLayer({
      id: DATASET_HIGHLIGHT_POLYGON_LAYER_ID,
      type: 'line',
      source: DATASET_HIGHLIGHT_SOURCE_ID,
      paint: {
        'line-color': '#ffffff',
        'line-width': 3,
      },
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
    })
  }
}

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const [draw, setDraw] = useState<MapboxDraw | null>(null)
  const [drawingEnabled, setDrawingEnabled] = useState(false)
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null)
  const [legend, setLegend] = useState<MapLegend | null>(null)
  const { showAlert } = useUI()

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
        if (options.clearExistingLayers) {
          clearDatasetLayers(map, setLegend)
        }

        let datasetWithGeojson: Dataset & { geojson?: FeatureCollection } = dataset as Dataset & {
          geojson?: FeatureCollection
        }

        if (!datasetWithGeojson.geojson) {
          const response = await apiClient.get(`/api/datasets/${dataset.id}`, {
            params: { farmId: dataset.farmId },
          })
          datasetWithGeojson = response.data
        }

        const needsCollectorRefresh =
          Boolean(datasetWithGeojson.collectorId) &&
          (!datasetWithGeojson.geojson ||
            datasetWithGeojson.processing?.status === 'pending' ||
            datasetWithGeojson.processing?.status === 'failed')

        if (needsCollectorRefresh) {
          try {
            showAlert(`Rebuilding “${dataset.name}” with the latest collector data…`, 'info')
            const rebuildResponse = await apiClient.post(`/api/farms/${dataset.farmId}/datasets/${dataset.id}/rebuild`)
            datasetWithGeojson = rebuildResponse.data
            window.dispatchEvent(new CustomEvent('datasets:refresh', { detail: { farmId: dataset.farmId } }))
            window.dispatchEvent(new CustomEvent('collectors:refresh', { detail: { farmId: dataset.farmId } }))
            window.dispatchEvent(new CustomEvent('datasetRecompiled', { detail: { dataset: datasetWithGeojson } }))
            showAlert(`“${datasetWithGeojson.name}” refreshed with collector data.`, 'success')
          } catch (rebuildError) {
            console.error('Failed to rebuild dataset before launch:', rebuildError)
            showAlert('Failed to rebuild dataset from collector data.', 'error')
          }
        }

        if (datasetWithGeojson.geojson) {
          await renderDatasetOnMap(map, datasetWithGeojson as Dataset & { geojson: FeatureCollection }, options, setLegend)
          setActiveDataset(datasetWithGeojson as Dataset)
        } else {
          console.warn('Dataset has no GeoJSON data to render')
        }
      } catch (error) {
        console.error('Failed to launch dataset:', error)
      }
    }

    const handleClearLayers = () => {
      if (!map) return
      clearDatasetLayers(map, setLegend)
      setActiveDataset(null)
    }

    const forwardLaunchDataset = (event: Event) => {
      handleLaunchDataset(event as CustomEvent)
    }

    window.addEventListener('launchDataset', forwardLaunchDataset)
    window.addEventListener('clearDatasetLayers', handleClearLayers)

    return () => {
      window.removeEventListener('launchDataset', forwardLaunchDataset)
      window.removeEventListener('clearDatasetLayers', handleClearLayers)
    }
  }, [map, showAlert])

  useEffect(() => {
    const handleDatasetRecompiled = (event: Event) => {
      if (!map) return
      const detail = (event as CustomEvent<{ dataset: Dataset & { geojson?: FeatureCollection } }>).detail
      const rebuilt = detail?.dataset
      if (!rebuilt || !rebuilt.geojson) return
      if (!activeDataset || rebuilt.id !== activeDataset.id) return

      ;(async () => {
        try {
          clearDatasetLayers(map, setLegend)
          await renderDatasetOnMap(
            map,
            rebuilt as Dataset & { geojson: FeatureCollection },
            { autoZoom: false, clearExistingLayers: false, openDetails: false },
            setLegend
          )
          setActiveDataset(rebuilt)
          showAlert(`Updated “${rebuilt.name}” with the latest collector data.`, 'success')
        } catch (error) {
          console.error('Failed to refresh dataset after rebuild:', error)
          showAlert('Failed to refresh dataset on the map after rebuild.', 'error')
        }
      })()
    }

    window.addEventListener('datasetRecompiled', handleDatasetRecompiled as EventListener)
    return () => {
      window.removeEventListener('datasetRecompiled', handleDatasetRecompiled as EventListener)
    }
  }, [map, activeDataset, showAlert])

  const value = useMemo(
    () => ({
      map,
      setMap,
      draw,
      setDraw,
      drawingEnabled,
      setDrawingEnabled,
      activeDataset,
      setActiveDataset,
      legend,
    }),
    [map, draw, drawingEnabled, activeDataset, legend]
  )

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>
}

const clearDatasetLayers = (map: mapboxgl.Map, setLegend: (legend: MapLegend | null) => void) => {
  const layersToRemove = [
    DATASET_POINT_LAYER_ID,
    DATASET_HEATMAP_LAYER_ID,
    DATASET_POLYGON_LAYER_ID,
    DATASET_POLYGON_OUTLINE_LAYER_ID,
    DATASET_HIGHLIGHT_POINT_LAYER_ID,
    DATASET_HIGHLIGHT_POLYGON_LAYER_ID,
  ]
  layersToRemove.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId)
    }
  })

  const sourcesToRemove = [DATASET_SOURCE_ID, DATASET_HIGHLIGHT_SOURCE_ID]
  sourcesToRemove.forEach((sourceId) => {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId)
    }
  })

  const handlers = getDatasetHandlers(map)
  if (handlers.pointClick) {
    map.off('click', DATASET_POINT_LAYER_ID, handlers.pointClick)
  }
  if (handlers.polygonClick) {
    map.off('click', DATASET_POLYGON_LAYER_ID, handlers.polygonClick)
  }
  ;(map as any).__datasetHandlers = {}
  setLegend(null)
}

const renderDatasetOnMap = async (
  map: mapboxgl.Map,
  dataset: Dataset & { geojson: FeatureCollection },
  options: LaunchOptions,
  setLegend: (legend: MapLegend | null) => void
) => {
  const geojson = dataset.geojson
  if (!geojson?.features?.length) {
    console.warn('Dataset has no features to render')
    return
  }

  if (map.getSource(DATASET_SOURCE_ID)) {
    ;(map.getSource(DATASET_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(geojson)
  } else {
    map.addSource(DATASET_SOURCE_ID, {
      type: 'geojson',
      data: geojson,
    })
  }

  const features = geojson.features as Feature[]
  const hasPoints = features.some((feature) => isPointGeometry(feature.geometry))
  const hasPolygons = features.some((feature) => isPolygonGeometry(feature.geometry))

  const vizSettings = (dataset.vizSettings as any) || {}
  const viz = {
    type: vizSettings.type ?? (hasPolygons && !hasPoints ? 'polygon' : 'circle'),
    colorBy: vizSettings.colorBy ?? 'solid',
    circleRadius: vizSettings.circleRadius ?? 6,
    circleColor: vizSettings.circleColor ?? '#ff6b6b',
    opacity: vizSettings.opacity ?? 0.85,
    colorHeader: vizSettings.colorHeader,
    colors: vizSettings.colors ?? DEFAULT_COLORS,
    classification: vizSettings.classification ?? vizSettings.zoneClassification ?? 'jenks',
    zones: vizSettings.zones ?? vizSettings.zoneStops ?? 5,
  }

  const legendTitle =
    (typeof vizSettings.colorHeader === 'string'
      ? vizSettings.colorHeader
      : vizSettings.colorHeader?.label) || dataset.name || 'Legend'

  if (hasPoints) {
    if (!map.getLayer(DATASET_POINT_LAYER_ID)) {
      map.addLayer({
        id: DATASET_POINT_LAYER_ID,
        type: 'circle',
        source: DATASET_SOURCE_ID,
        paint: {
          'circle-radius': viz.circleRadius,
          'circle-color': viz.circleColor,
          'circle-opacity': viz.opacity,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
        filter: ['==', ['geometry-type'], 'Point'],
      })
    }
    map.setPaintProperty(DATASET_POINT_LAYER_ID, 'circle-radius', viz.circleRadius)
    map.setPaintProperty(DATASET_POINT_LAYER_ID, 'circle-opacity', viz.opacity)

    if (viz.colorBy === 'valueBased' && viz.colorHeader) {
      const numericValues = extractNumericValues(features, viz.colorHeader)
      if (numericValues.length) {
        const breaks = computeBreaks(numericValues, viz.classification, viz.zones)
        const expression = buildValueExpression(viz.colorHeader, breaks, viz.colors)
        map.setPaintProperty(DATASET_POINT_LAYER_ID, 'circle-color', expression as any)
      } else {
        const categories = Array.from(
          new Set(
            features
              .map((feature) => feature.properties?.[viz.colorHeader])
              .filter((value): value is string => typeof value === 'string')
          )
        )
        if (categories.length) {
          const expression = buildCategoryExpression(viz.colorHeader, categories, viz.colors)
          map.setPaintProperty(DATASET_POINT_LAYER_ID, 'circle-color', expression as any)
        } else {
          map.setPaintProperty(DATASET_POINT_LAYER_ID, 'circle-color', viz.circleColor)
        }
      }
    } else {
      map.setPaintProperty(DATASET_POINT_LAYER_ID, 'circle-color', viz.circleColor)
    }
  } else if (map.getLayer(DATASET_POINT_LAYER_ID)) {
    map.removeLayer(DATASET_POINT_LAYER_ID)
  }

  if (hasPolygons) {
    if (!map.getLayer(DATASET_POLYGON_LAYER_ID)) {
      map.addLayer({
        id: DATASET_POLYGON_LAYER_ID,
        type: 'fill',
        source: DATASET_SOURCE_ID,
        paint: {
          'fill-color': viz.circleColor,
          'fill-opacity': viz.opacity,
        },
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      })
    }
    if (!map.getLayer(DATASET_POLYGON_OUTLINE_LAYER_ID)) {
      map.addLayer({
        id: DATASET_POLYGON_OUTLINE_LAYER_ID,
        type: 'line',
        source: DATASET_SOURCE_ID,
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.5,
        },
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      })
    }

    if (viz.colorBy === 'valueBased' && viz.colorHeader) {
      const numericValues = extractNumericValues(features, viz.colorHeader)
      if (numericValues.length) {
        const breaks = computeBreaks(numericValues, viz.classification, viz.zones)
        const expression = buildValueExpression(viz.colorHeader, breaks, viz.colors)
        map.setPaintProperty(DATASET_POLYGON_LAYER_ID, 'fill-color', expression as any)
      }
    } else {
      map.setPaintProperty(DATASET_POLYGON_LAYER_ID, 'fill-color', viz.circleColor)
    }
    map.setPaintProperty(DATASET_POLYGON_LAYER_ID, 'fill-opacity', viz.opacity)
  } else {
    if (map.getLayer(DATASET_POLYGON_LAYER_ID)) {
      map.removeLayer(DATASET_POLYGON_LAYER_ID)
    }
    if (map.getLayer(DATASET_POLYGON_OUTLINE_LAYER_ID)) {
      map.removeLayer(DATASET_POLYGON_OUTLINE_LAYER_ID)
    }
  }

  ensureHighlightLayers(map)

  const highlightFeature = (feature: Feature) => {
    const highlightSource = map.getSource(DATASET_HIGHLIGHT_SOURCE_ID) as mapboxgl.GeoJSONSource
    if (highlightSource) {
      highlightSource.setData({
        type: 'FeatureCollection',
        features: [feature],
      })
    }
  }

  const handlers = getDatasetHandlers(map)
  if (handlers.pointClick) {
    map.off('click', DATASET_POINT_LAYER_ID, handlers.pointClick)
  }
  if (handlers.polygonClick) {
    map.off('click', DATASET_POLYGON_LAYER_ID, handlers.polygonClick)
  }

  if (hasPoints) {
    const handlePointClick = (event: MapMouseEvent) => {
      const feature = event.features?.[0] as Feature | undefined
      if (!feature) return
      highlightFeature(feature)
      window.dispatchEvent(
        new CustomEvent('dataPointClick', {
          detail: { feature, dataset },
        })
      )
    }
    handlers.pointClick = handlePointClick
    map.on('click', DATASET_POINT_LAYER_ID, handlePointClick)
    map.on('mouseenter', DATASET_POINT_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', DATASET_POINT_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
    })
  }

  if (hasPolygons) {
    const handlePolygonClick = (event: MapMouseEvent) => {
      const feature = event.features?.[0] as Feature | undefined
      if (!feature) return
      highlightFeature(feature)
      window.dispatchEvent(
        new CustomEvent('dataPointClick', {
          detail: { feature, dataset },
        })
      )
    }
    handlers.polygonClick = handlePolygonClick
    map.on('click', DATASET_POLYGON_LAYER_ID, handlePolygonClick)
    map.on('mouseenter', DATASET_POLYGON_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', DATASET_POLYGON_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
    })
  }

  let legendMode: MapLegend['mode'] = 'single'
  const legendEntries: LegendEntry[] = []
  let legendMin: number | undefined
  let legendMax: number | undefined

  if (viz.colorBy === 'valueBased' && viz.colorHeader) {
    const numericValues = extractNumericValues(features, viz.colorHeader)
    if (numericValues.length) {
      legendMode = 'range'
      legendMin = Math.min(...numericValues)
      legendMax = Math.max(...numericValues)
      const breaks = computeBreaks(numericValues, viz.classification, viz.zones)
      const palette = [...viz.colors]
      while (palette.length < breaks.length + 1) {
        palette.push(DEFAULT_COLORS[palette.length % DEFAULT_COLORS.length])
      }
      const sortedBreaks = [...breaks].sort((a, b) => a - b)
      let lowerBound = legendMin
      sortedBreaks.forEach((stop, index) => {
        legendEntries.push({
          color: palette[index],
          label: `Range ${index + 1}`,
          min: lowerBound,
          max: stop,
        })
        lowerBound = stop
      })
      legendEntries.push({
        color: palette[sortedBreaks.length],
        label: `Range ${sortedBreaks.length + 1}`,
        min: lowerBound,
        max: legendMax,
      })
    } else {
      const categorySet = new Set(
        features
          .map((feature) => feature.properties?.[viz.colorHeader as keyof typeof feature.properties])
          .filter((value): value is string => typeof value === 'string')
      )
      if (categorySet.size > 0) {
        legendMode = 'category'
        const categories = Array.from(categorySet)
        const palette = [...viz.colors]
        while (palette.length < categories.length) {
          palette.push(DEFAULT_COLORS[palette.length % DEFAULT_COLORS.length])
        }
        categories.forEach((category, index) => {
          legendEntries.push({
            color: palette[index],
            label: category,
          })
        })
      }
    }
  }

  if (legendEntries.length === 0) {
    legendEntries.push({ color: viz.circleColor, label: legendTitle })
    legendMode = 'single'
  }

  setLegend({ title: legendTitle, mode: legendMode, entries: legendEntries, min: legendMin, max: legendMax })

  if (options.autoZoom) {
    try {
      const bounds = computeBounds(geojson)
      if (bounds) {
        map.fitBounds(bounds, { padding: 60, duration: 1000 })
      }
    } catch (error) {
      console.warn('Failed to auto-zoom to dataset:', error)
    }
  }
}

export function useMapContext() {
  const context = useContext(MapContext)
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider')
  }
  return context
}
