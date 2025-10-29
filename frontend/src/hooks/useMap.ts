import { useState, useCallback } from 'react'
import type * as mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
// @ts-ignore - turf module resolution issue with bundler
import * as turf from '@turf/turf'

export function useMap() {
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const [draw, setDraw] = useState<MapboxDraw | null>(null)

  const addGeoJSONSource = useCallback(
    (sourceId: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) => {
      if (!map) return

      if (map.getSource(sourceId)) {
        const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource
        source.setData(data as any)
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: data as any,
        })
      }
    },
    [map]
  )

  const addLayer = useCallback(
    (layer: mapboxgl.AnyLayer) => {
      if (!map) return

      if (!map.getLayer(layer.id)) {
        map.addLayer(layer)
      }
    },
    [map]
  )

  const removeLayer = useCallback(
    (layerId: string) => {
      if (!map) return

      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
    },
    [map]
  )

  const removeSource = useCallback(
    (sourceId: string) => {
      if (!map) return

      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }
    },
    [map]
  )

  const fitBounds = useCallback(
    (geojson: GeoJSON.FeatureCollection | GeoJSON.Feature, padding = 50) => {
      if (!map) return

      const bbox = turf.bbox(geojson)
      map.fitBounds(bbox as [number, number, number, number], { padding })
    },
    [map]
  )

  const flyTo = useCallback(
    (center: [number, number], zoom?: number) => {
      if (!map) return

      map.flyTo({
        center,
        zoom: zoom || map.getZoom(),
        duration: 1000,
      })
    },
    [map]
  )

  const setDrawMode = useCallback(
    (mode: string) => {
      if (!draw) return

      draw.changeMode(mode as any)
    },
    [draw]
  )

  const getDrawnFeatures = useCallback(() => {
    if (!draw) return []

    return draw.getAll().features
  }, [draw])

  const deleteDrawnFeature = useCallback(
    (featureId: string) => {
      if (!draw) return

      draw.delete(featureId)
    },
    [draw]
  )

  const clearDrawing = useCallback(() => {
    if (!draw) return

    draw.deleteAll()
  }, [draw])

  return {
    map,
    setMap,
    draw,
    setDraw,
    addGeoJSONSource,
    addLayer,
    removeLayer,
    removeSource,
    fitBounds,
    flyTo,
    setDrawMode,
    getDrawnFeatures,
    deleteDrawnFeature,
    clearDrawing,
  }
}
