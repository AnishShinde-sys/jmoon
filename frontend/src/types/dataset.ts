export interface VizSettings {
  classification: 'jenks' | 'equal' | 'quantile'
  zones: number
  colorSetting: 'linear' | 'stepped'
  interpolated: boolean
  interpolatedMin?: number
  interpolatedMax?: number
  min?: number
  max?: number
  header?: string
  filters?: DatasetFilter[]
  recalculateJenks?: boolean
  recalculateRange?: boolean
}

export interface DatasetFilter {
  header: string
  min: number
  max: number
}

export interface Dataset {
  id: string
  farmId: string
  name: string
  description?: string
  folderId: string
  headers: string[]
  dynamic: boolean
  collectorId?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  vizSettings: VizSettings
  processing?: {
    status: 'pending' | 'processing' | 'ready' | 'error'
    message?: string
  }
}

export interface CreateDatasetInput {
  farmId: string
  name: string
  description?: string
  folderId?: string
}

export interface UpdateDatasetInput {
  name?: string
  description?: string
  folderId?: string
  vizSettings?: Partial<VizSettings>
}

export interface DatasetUploadResponse {
  datasetId: string
  status: 'pending' | 'processing'
}
