export interface VizSettings {
  classification?: 'jenks' | 'equal' | 'quantile'
  zones?: number
  colorSetting?: 'linear' | 'stepped'
  interpolated?: boolean
  interpolatedMin?: number
  interpolatedMax?: number
  min?: number
  max?: number
  header?: string
  filters?: DatasetFilter[]
  recalculateJenks?: boolean
  recalculateRange?: boolean
  type?: 'circle' | 'polygon' | 'heatmap'
  colorBy?: 'solid' | 'valueBased'
  circleRadius?: number
  circleColor?: string
  opacity?: number
  colorHeader?: string
  colors?: string[]
  zoneClassification?: string
  zoneStops?: number
  featureCategories?: Array<{ label: string; color: string; value: string | number }>
  minValue?: number | false
  maxValue?: number | false
  categorical?: boolean
  number?: boolean
}

export interface DatasetFilter {
  header: string
  min: number
  max: number
}

export interface DatasetProcessing {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  updatedAt?: string
}

export interface Dataset {
  id: string
  farmId: string
  name: string
  description?: string
  folderId?: string
  headers?: string[]
  originalHeaders?: string[]
  dynamic?: boolean
  collectorId?: string
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  vizSettings?: VizSettings
  processing?: DatasetProcessing
  status?: 'uploading' | 'processing' | 'completed' | 'failed'
  type?: DatasetType
  recordCount?: number
  columnMapping?: DatasetColumnMapping
  fields?: string[]
  bounds?: [number, number, number, number]
  geojsonPath?: string
  rasterPath?: string
  uploadedBy?: string
}

export interface CreateDatasetInput {
  farmId: string
  name: string
  description?: string
  folderId?: string
  columnMapping?: DatasetColumnMapping
  originalHeaders?: string[]
  type?: DatasetType
}

export interface UpdateDatasetInput {
  name?: string
  description?: string
  folderId?: string
  vizSettings?: Partial<VizSettings>
  columnMapping?: DatasetColumnMapping
  originalHeaders?: string[]
  revisionMessage?: string
}

export interface DatasetUploadResponse {
  datasetId: string
  status: 'pending' | 'processing'
}

export type DatasetColumnMapping = Record<string, string>

export interface DatasetRevision {
  id: string
  datasetId: string
  farmId: string
  createdAt: string
  updatedBy: string
  updatedByName?: string
  revisionMessage?: string
  snapshot: Dataset
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

export type DatasetType = 'geojson' | 'csv' | 'shapefile' | 'kml' | 'tiff' | 'image'
