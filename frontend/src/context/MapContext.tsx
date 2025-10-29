import { createContext, useContext, useState, ReactNode } from 'react'
import type * as mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'

interface MapContextType {
  map: mapboxgl.Map | null
  setMap: (map: mapboxgl.Map | null) => void
  draw: MapboxDraw | null
  setDraw: (draw: MapboxDraw | null) => void
  drawingEnabled: boolean
  setDrawingEnabled: (enabled: boolean) => void
}

const MapContext = createContext<MapContextType | undefined>(undefined)

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const [draw, setDraw] = useState<MapboxDraw | null>(null)
  const [drawingEnabled, setDrawingEnabled] = useState(false)

  const value = {
    map,
    setMap,
    draw,
    setDraw,
    drawingEnabled,
    setDrawingEnabled,
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
