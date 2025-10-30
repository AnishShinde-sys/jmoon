/**
 * Backend Type Definitions
 * Shared types for the Budbase backend API
 */

// ============================================================================
// User Types
// ============================================================================

export interface UserProfile {
  id: string
  email: string
  name?: string
  role: 'admin' | 'user'
  organization?: string
  createdAt: string
  updatedAt?: string
}

// ============================================================================
// Farm Types
// ============================================================================

export interface FarmCollaborator {
  userId: string
  email: string
  role: 'owner' | 'editor' | 'viewer'
  addedAt: string
}

export interface Farm {
  id: string
  name: string
  location: {
    latitude: number
    longitude: number
    address?: string
  }
  owner: string // User ID
  collaborators?: FarmCollaborator[]
  plugins?: string[]
  createdAt: string
  updatedAt: string
  blockCount: number
  datasetCount: number
  totalArea: number // square meters
}

export interface CreateFarmInput {
  name: string
  location: {
    latitude: number
    longitude: number
    address?: string
  }
}

export interface UpdateFarmInput {
  name?: string
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
}

// ============================================================================
// Block Types
// ============================================================================

export interface BlockField {
  key: string
  label: string
  value: string | number | boolean
  dataType: 'string' | 'number' | 'boolean' | 'date'
}

export interface Block {
  id: string
  farmId: string
  name: string
  variety?: string
  plantingYear?: number
  rowSpacing?: number // meters
  vineSpacing?: number // meters
  area: number // square meters
  customFields?: BlockField[]
  createdAt: string
  updatedAt: string
  revisionMessage?: string
  updatedBy?: string
  updatedByName?: string
}

export interface BlockRevision {
  id: string
  farmId: string
  blockId: string
  createdAt: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.Geometry
  properties: Block
  revisionMessage?: string
  updatedBy?: string
  updatedByName?: string
}

export interface CreateBlockInput {
  name: string
  variety?: string
  plantingYear?: number
  rowSpacing?: number
  vineSpacing?: number
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  customFields?: BlockField[]
}

// ============================================================================
// Dataset Types
// ============================================================================

export type DatasetType =
  | 'geojson'
  | 'csv'
  | 'shapefile'
  | 'kml'
  | 'tiff'
  | 'image'

export type DatasetStatus =
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'

export type VizType = 'heatmap' | 'zones' | 'points' | 'none'

export interface VizSettings {
  enabled: boolean
  type: VizType
  field: string
  colorScale: 'viridis' | 'plasma' | 'inferno' | 'magma' | 'cool' | 'warm'
  opacity: number
  numClasses?: number // For Jenks classification
  classBreaks?: number[]
  colors?: string[]
}

export interface Dataset {
  id: string
  farmId: string
  name: string
  type: DatasetType
  description?: string
  status: DatasetStatus
  uploadedBy: string // User ID
  collectedAt: string
  collectorId?: string
  vizSettings?: VizSettings
  createdAt: string
  updatedAt: string
  processedAt?: string
  fileSize: number
  originalFilename: string
  recordCount?: number
  bounds?: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
  error?: string
  folderId?: string
  fields?: string[]
  columnMapping?: Record<string, string>
  originalHeaders?: string[]
  geojsonPath?: string
  rasterPath?: string
}

export interface CreateDatasetInput {
  name: string
  type: DatasetType
  description?: string
  collectedAt?: string
  collectorId?: string
  folderId?: string
  columnMapping?: Record<string, string>
  originalHeaders?: string[]
}

export interface DatasetRevision {
  id: string
  datasetId: string
  farmId: string
  createdAt: string
  updatedBy: string
  updatedByName?: string
  snapshot: Dataset
  revisionMessage?: string
}

export interface DatasetFolder {
  id: string
  farmId: string
  name: string
  description?: string
  parentId: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Data Collector Types
// ============================================================================

export interface CollectorField {
  label: string
  machine_name: string
  type: 'Text' | 'Number' | 'Select' | 'Date and Time' | 'Image' | 'Computer Vision' | 'CV Number'
  options?: string[]
  required?: boolean
  group?: string
  hidden?: boolean
  min?: number
  max?: number
  step?: number
  suffix?: string
}

export interface Collector {
  id: string
  farmId: string
  name: string
  description?: string
  fields: CollectorField[]
  datasetId?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  reCompile?: boolean
  editors?: string[]
}

export interface DataPoint {
  id: string
  collectorId: string
  geolocation: {
    latitude: number
    longitude: number
  }
  [key: string]: any // Dynamic fields based on collector definition
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CreateCollectorInput {
  farmId: string
  name: string
  description?: string
  fields: CollectorField[]
}

export interface CreateDataPointInput {
  collectorId: string
  geolocation: {
    latitude: number
    longitude: number
  }
  [key: string]: any // Dynamic fields
}

export interface DataCollector {
  id: string
  farmId: string
  name: string
  type: 'manual' | 'sensor' | 'drone' | 'satellite'
  config?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Folder Types
// ============================================================================

export interface Folder {
  id: string
  farmId: string
  name: string
  parentId?: string
  createdAt: string
}

// ============================================================================
// GeoJSON Types
// ============================================================================

export namespace GeoJSON {
  export interface Point {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }

  export interface LineString {
    type: 'LineString'
    coordinates: [number, number][]
  }

  export interface Polygon {
    type: 'Polygon'
    coordinates: [number, number][][]
  }

  export interface MultiPolygon {
    type: 'MultiPolygon'
    coordinates: [number, number][][][]
  }

  export type Geometry = Point | LineString | Polygon | MultiPolygon

  export interface Feature<G = Geometry, P = any> {
    type: 'Feature'
    id?: string | number
    geometry: G
    properties: P
  }

  export interface FeatureCollection<G = Geometry, P = any> {
    type: 'FeatureCollection'
    features: Feature<G, P>[]
  }
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  error: string
  message: string
  details?: any
  stack?: string
}

export interface ApiSuccess<T = any> {
  data: T
  message?: string
}
