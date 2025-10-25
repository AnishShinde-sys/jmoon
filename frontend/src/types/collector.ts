export interface CollectorField {
  label: string
  machine_name: string
  type: 'Text' | 'Number' | 'Select' | 'Date and Time' | 'Image' | 'Computer Vision'
  options?: string[]
  required?: boolean
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
  reCompile: boolean
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
