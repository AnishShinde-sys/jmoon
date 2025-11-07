// @ts-ignore - turf module resolution issue with bundler
import * as turf from '@turf/turf'

export const geospatialService = {
  /**
   * Calculate area of a polygon feature in square meters
   */
  calculateArea(feature: GeoJSON.Feature): number {
    return turf.area(feature)
  },

  /**
   * Convert square meters to hectares
   */
  toHectares(squareMeters: number): number {
    return squareMeters / 10000
  },

  /**
   * Convert square meters to acres
   */
  toAcres(squareMeters: number): number {
    return squareMeters / 4047
  },

  /**
   * Check if a point is within a polygon
   */
  pointInPolygon(point: [number, number], polygon: GeoJSON.Feature): boolean {
    const pt = turf.point(point)
    return turf.booleanPointInPolygon(pt, polygon)
  },

  /**
   * Get the bounding box of a feature or feature collection
   */
  getBounds(geojson: GeoJSON.Feature | GeoJSON.FeatureCollection): [number, number, number, number] {
    return turf.bbox(geojson) as [number, number, number, number]
  },

  /**
   * Get the center point of a feature or feature collection
   */
  getCenter(geojson: GeoJSON.Feature | GeoJSON.FeatureCollection): [number, number] {
    const center = turf.center(geojson)
    return center.geometry.coordinates as [number, number]
  },

  /**
   * Calculate distance between two points in meters
   */
  distance(from: [number, number], to: [number, number]): number {
    const pt1 = turf.point(from)
    const pt2 = turf.point(to)
    return turf.distance(pt1, pt2, { units: 'meters' })
  },

  /**
   * Simplify a geometry (reduce number of points)
   */
  simplify(feature: GeoJSON.Feature, tolerance: number = 0.01): GeoJSON.Feature {
    return turf.simplify(feature, { tolerance, highQuality: true })
  },

  /**
   * Buffer a feature by a given distance in meters
   */
  buffer(feature: GeoJSON.Feature, radius: number): GeoJSON.Feature {
    return turf.buffer(feature, radius, { units: 'meters' })
  },
}

export default geospatialService
