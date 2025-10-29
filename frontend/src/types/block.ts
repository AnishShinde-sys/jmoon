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
  rowSpacing?: number
  vineSpacing?: number
  area: number // Square meters
  customFields?: BlockField[]
  createdAt: string
  updatedAt: string
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

export interface UpdateBlockInput {
  name?: string
  description?: string
  footprint?: string
  customFields?: Record<string, any>
}
