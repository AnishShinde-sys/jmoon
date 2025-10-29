import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'

// Initialize Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

export interface MapConfig {
  container: string | HTMLElement
  style?: string
  center?: [number, number]
  zoom?: number
  pitch?: number
  bearing?: number
}

export class MapService {
  private map: mapboxgl.Map | null = null
  private draw: MapboxDraw | null = null
  private geocoder: MapboxGeocoder | null = null

  /**
   * Initialize a new Mapbox map
   */
  initializeMap(config: MapConfig): mapboxgl.Map {
    this.map = new mapboxgl.Map({
      container: config.container,
      style: config.style || 'mapbox://styles/mapbox/satellite-streets-v12',
      center: config.center || [-122.5, 38.5],
      zoom: config.zoom || 10,
      pitch: config.pitch || 0,
      bearing: config.bearing || 0,
    })

    // Add navigation controls
    this.map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add scale control
    this.map.addControl(new mapboxgl.ScaleControl(), 'bottom-left')

    return this.map
  }

  /**
   * Add drawing controls to the map
   */
  addDrawControls(): MapboxDraw | null {
    if (!this.map) return null

    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        point: true,
        line_string: true,
        trash: true,
      },
      defaultMode: 'simple_select',
    })

    this.map.addControl(this.draw as any, 'top-left')
    return this.draw
  }

  /**
   * Add geocoder (search) control to the map
   */
  addGeocoder(): MapboxGeocoder | null {
    if (!this.map) return null

    const token = mapboxgl.accessToken || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''
    this.geocoder = new MapboxGeocoder({
      accessToken: token,
      mapboxgl: mapboxgl as any,
      marker: false,
    })

    this.map.addControl(this.geocoder as any, 'top-left')
    return this.geocoder
  }

  /**
   * Add a GeoJSON source to the map
   */
  addGeoJSONSource(sourceId: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) {
    if (!this.map) return

    if (this.map.getSource(sourceId)) {
      (this.map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data as any)
    } else {
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: data as any,
      })
    }
  }

  /**
   * Add a layer to the map
   */
  addLayer(layer: mapboxgl.AnyLayer) {
    if (!this.map) return

    if (!this.map.getLayer(layer.id)) {
      this.map.addLayer(layer)
    }
  }

  /**
   * Fit map to bounds of a GeoJSON feature
   */
  fitBounds(geojson: GeoJSON.Feature | GeoJSON.FeatureCollection, padding: number = 50) {
    if (!this.map) return

    const bounds = new mapboxgl.LngLatBounds()

    const addCoordinatesToBounds = (coords: any) => {
      if (Array.isArray(coords[0])) {
        coords.forEach((coord: any) => addCoordinatesToBounds(coord))
      } else {
        bounds.extend(coords as [number, number])
      }
    }

    if (geojson.type === 'FeatureCollection') {
      geojson.features.forEach((feature) => {
        if (feature.geometry.type === 'Point') {
          bounds.extend(feature.geometry.coordinates as [number, number])
        } else if ('coordinates' in feature.geometry) {
          addCoordinatesToBounds(feature.geometry.coordinates)
        }
      })
    } else if (geojson.type === 'Feature') {
      if (geojson.geometry.type === 'Point') {
        bounds.extend(geojson.geometry.coordinates as [number, number])
      } else if ('coordinates' in geojson.geometry) {
        addCoordinatesToBounds(geojson.geometry.coordinates)
      }
    }

    this.map.fitBounds(bounds, { padding })
  }

  /**
   * Get the map instance
   */
  getMap(): mapboxgl.Map | null {
    return this.map
  }

  /**
   * Get the draw instance
   */
  getDraw(): MapboxDraw | null {
    return this.draw
  }

  /**
   * Cleanup map resources
   */
  cleanup() {
    if (this.map) {
      this.map.remove()
      this.map = null
    }
    this.draw = null
    this.geocoder = null
  }
}

export default new MapService()
