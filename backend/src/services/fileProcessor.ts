/**
 * File Processor Service
 * Converts various file formats to GeoJSON for visualization
 * Ported from Budbase_old Cloud Functions
 */

import Papa from 'papaparse'
import * as turf from '@turf/turf'
import { DOMParser } from 'xmldom'
import * as toGeoJSON from 'togeojson'
import JSZip from 'jszip'
import shp from 'shpjs'
import sharp from 'sharp'
import csv2geojson from 'csv2geojson'
import proj4 from 'proj4'
import epsg from 'epsg'
import type { FeatureCollection, Feature, Point, Polygon } from 'geojson'

export interface ProcessingResult {
  geojson: FeatureCollection
  recordCount: number
  bounds: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
  fields: string[]
  error?: string
}

/**
 * Helper to calculate bounds from GeoJSON
 */
function calculateBounds(geojson: FeatureCollection): [number, number, number, number] {
  const bbox = turf.bbox(geojson)
  return [bbox[0], bbox[1], bbox[2], bbox[3]]
}

/**
 * Process CSV file to GeoJSON
 * Supports various coordinate column names and Lambert 93 (EPSG:2154)
 */
export async function processCSV(buffer: Buffer): Promise<ProcessingResult> {
  const text = buffer.toString('utf-8')

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data as any[]

          // Find coordinate columns
          const headers = Object.keys(data[0] || {})
          let latField = headers.find((h) => h.toLowerCase() === 'latitude' || h.toLowerCase() === 'lat' || h.toLowerCase() === 'y')
          let lonField = headers.find((h) => h.toLowerCase() === 'longitude' || h.toLowerCase() === 'lon' || h.toLowerCase() === 'x')
          
          // Check for Lambert 93 (EPSG:2154)
          let isLambert93 = false
          if (!latField && !lonField) {
            if (headers.includes('Y-Lamb') && headers.includes('X-Lamb')) {
              latField = 'Y-Lamb'
              lonField = 'X-Lamb'
              isLambert93 = true
              console.log('Lambert-93 detected (EPSG:2154)')
            }
          }

          if (!latField || !lonField) {
            throw new Error(
              'CSV must contain latitude/longitude columns (lat/lon, latitude/longitude, x/y, or X-Lamb/Y-Lamb)'
            )
          }

          // Convert Lambert 93 to WGS84 if needed
          if (isLambert93) {
            const firstProjection = epsg['EPSG:2154']
            const secondProjection = epsg['EPSG:4326']
            
            for (let i = data.length - 1; i >= 0; i--) {
              const row = data[i]
              if (typeof row['X-Lamb'] === 'number' && typeof row['Y-Lamb'] === 'number') {
                const newCoords = proj4(firstProjection, secondProjection, [row['X-Lamb'], row['Y-Lamb']])
                row['X-Lamb'] = newCoords[0]
                row['Y-Lamb'] = newCoords[1]
              } else {
                console.log('No coords at position ' + i)
                data.splice(i, 1)
              }
            }
          }

          // Convert to GeoJSON using csv2geojson
          const geojson = csv2geojson.csv2geojson(data, {
            latfield: latField,
            lonfield: lonField,
            delimiter: ',',
          }) as FeatureCollection

          if (!geojson || !geojson.features || geojson.features.length === 0) {
            throw new Error('No valid coordinates found in CSV')
          }

          const bounds = calculateBounds(geojson)
          const fields = headers.filter((h) => h !== latField && h !== lonField)

          resolve({
            geojson,
            recordCount: geojson.features.length,
            bounds,
            fields,
          })
        } catch (error: any) {
          reject(error)
        }
      },
      error: (error: any) => {
        reject(new Error(`CSV parsing error: ${error.message}`))
      },
    })
  })
}

/**
 * Process GeoJSON file
 * Validates and normalizes GeoJSON
 */
export async function processGeoJSON(buffer: Buffer): Promise<ProcessingResult> {
  try {
    const text = buffer.toString('utf-8')
    const geojson = JSON.parse(text)

    // Validate GeoJSON
    if (!geojson.type) {
      throw new Error('Invalid GeoJSON: missing type property')
    }

    // Convert single Feature to FeatureCollection
    let featureCollection: GeoJSON.FeatureCollection
    if (geojson.type === 'Feature') {
      featureCollection = {
        type: 'FeatureCollection',
        features: [geojson],
      }
    } else if (geojson.type === 'FeatureCollection') {
      featureCollection = geojson
    } else {
      throw new Error('GeoJSON must be a Feature or FeatureCollection')
    }

    // Calculate bounds
    const bounds = calculateBounds(featureCollection)

    // Extract field names from first feature
    const fields = featureCollection.features[0]?.properties
      ? Object.keys(featureCollection.features[0].properties)
      : []

    return {
      geojson: featureCollection,
      recordCount: featureCollection.features.length,
      bounds,
      fields,
    }
  } catch (error: any) {
    throw new Error(`GeoJSON processing error: ${error.message}`)
  }
}

/**
 * Process KML file to GeoJSON
 */
export async function processKML(buffer: Buffer): Promise<ProcessingResult> {
  try {
    const text = buffer.toString('utf-8')
    const kmlDom = new DOMParser().parseFromString(text, 'text/xml')
    const geojson = toGeoJSON.kml(kmlDom) as FeatureCollection

    if (!geojson || !geojson.features) {
      throw new Error('No valid features in KML file')
    }

    const bounds = calculateBounds(geojson)
    const fields = geojson.features[0]?.properties
      ? Object.keys(geojson.features[0].properties)
      : []

    return {
      geojson,
      recordCount: geojson.features.length,
      bounds,
      fields,
    }
  } catch (error: any) {
    throw new Error(`KML processing error: ${error.message}`)
  }
}

/**
 * Process KMZ (zipped KML) file to GeoJSON
 */
export async function processKMZ(buffer: Buffer): Promise<ProcessingResult> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    
    // Find KML file in ZIP
    let kmlFile: JSZip.JSZipObject | null = null
    zip.forEach((relPath, file) => {
      if (relPath.endsWith('.kml') && kmlFile === null) {
        kmlFile = file
      }
    })

    if (!kmlFile) {
      throw new Error('No KML file found in KMZ archive')
    }

    const kmlText = await kmlFile.async('string')
    const kmlDom = new DOMParser().parseFromString(kmlText, 'text/xml')
    const geojson = toGeoJSON.kml(kmlDom) as FeatureCollection

    if (!geojson || !geojson.features) {
      throw new Error('No valid features in KMZ file')
    }

    const bounds = calculateBounds(geojson)
    const fields = geojson.features[0]?.properties
      ? Object.keys(geojson.features[0].properties)
      : []

    return {
      geojson,
      recordCount: geojson.features.length,
      bounds,
      fields,
    }
  } catch (error: any) {
    throw new Error(`KMZ processing error: ${error.message}`)
  }
}

/**
 * Process Shapefile (ZIP) to GeoJSON
 */
export async function processShapefile(buffer: Buffer): Promise<ProcessingResult> {
  try {
    const geojson = await shp(buffer)

    if (!geojson || !geojson.features) {
      throw new Error('No valid features in Shapefile')
    }

    const bounds = calculateBounds(geojson)
    const fields = geojson.features[0]?.properties
      ? Object.keys(geojson.features[0].properties)
      : []

    return {
      geojson,
      recordCount: geojson.features.length,
      bounds,
      fields,
    }
  } catch (error: any) {
    throw new Error(`Shapefile processing error: ${error.message}`)
  }
}

/**
 * Process TIFF file
 * Converts to JPG and returns metadata
 * Note: This doesn't produce GeoJSON, just converts the image
 */
export async function processTIFF(buffer: Buffer): Promise<Buffer> {
  try {
    // Convert TIFF to JPG using sharp
    const jpgBuffer = await sharp(buffer)
      .resize(1000, null, {
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer()

    return jpgBuffer
  } catch (error: any) {
    throw new Error(`TIFF processing error: ${error.message}`)
  }
}

/**
 * Detect file type from buffer
 */
export function detectFileType(buffer: Buffer, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'geojson' || ext === 'json') {
    return 'geojson'
  }

  if (ext === 'csv' || ext === 'txt') {
    return 'csv'
  }

  if (ext === 'kml') {
    return 'kml'
  }

  if (ext === 'kmz') {
    return 'kmz'
  }

  if (ext === 'zip') {
    return 'shapefile'
  }

  if (ext === 'tif' || ext === 'tiff') {
    return 'tiff'
  }

  // Try to detect JSON content
  try {
    const text = buffer.toString('utf-8', 0, 1000)
    const trimmed = text.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'geojson'
    }
  } catch (error) {
    // Not UTF-8 text
  }

  return 'unknown'
}

/**
 * Process file based on type
 */
export async function processFile(
  buffer: Buffer,
  filename: string
): Promise<ProcessingResult> {
  const fileType = detectFileType(buffer, filename)

  switch (fileType) {
    case 'csv':
      return processCSV(buffer)

    case 'geojson':
      return processGeoJSON(buffer)

    case 'kml':
      return processKML(buffer)

    case 'kmz':
      return processKMZ(buffer)

    case 'shapefile':
      return processShapefile(buffer)

    case 'tiff':
      throw new Error('TIFF files are raster images and cannot be directly converted to GeoJSON. Use processTIFFImage() instead.')

    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }
}

/**
 * Process TIFF image (returns JPG buffer, not GeoJSON)
 */
export async function processTIFFImage(buffer: Buffer): Promise<Buffer> {
  return processTIFF(buffer)
}

/**
 * Calculate statistics for a dataset field
 */
export function calculateFieldStats(
  geojson: GeoJSON.FeatureCollection,
  fieldName: string
) {
  const values: number[] = []

  for (const feature of geojson.features) {
    const value = feature.properties?.[fieldName]
    if (typeof value === 'number' && !isNaN(value)) {
      values.push(value)
    }
  }

  if (values.length === 0) {
    return null
  }

  values.sort((a, b) => a - b)

  const sum = values.reduce((acc, val) => acc + val, 0)
  const mean = sum / values.length
  const min = values[0]
  const max = values[values.length - 1]
  const median = values[Math.floor(values.length / 2)]

  // Calculate standard deviation
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length
  const stdDev = Math.sqrt(variance)

  return {
    count: values.length,
    min,
    max,
    mean,
    median,
    stdDev,
  }
}

/**
 * Generate Jenks natural breaks for classification
 * Simple implementation of Jenks algorithm
 */
export function calculateJenksBreaks(
  geojson: GeoJSON.FeatureCollection,
  fieldName: string,
  numClasses: number
): number[] {
  const values: number[] = []

  for (const feature of geojson.features) {
    const value = feature.properties?.[fieldName]
    if (typeof value === 'number' && !isNaN(value)) {
      values.push(value)
    }
  }

  if (values.length === 0) {
    return []
  }

  // For simplicity, use quantile breaks
  // In production, you'd want to use a proper Jenks algorithm
  values.sort((a, b) => a - b)
  const breaks: number[] = []

  for (let i = 1; i < numClasses; i++) {
    const index = Math.floor((i / numClasses) * values.length)
    breaks.push(values[index])
  }

  return breaks
}