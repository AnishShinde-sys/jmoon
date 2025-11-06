export interface BlockField {
  key: string
  label: string
  value: string | number | boolean
  dataType: 'string' | 'number' | 'boolean' | 'date'
}

export type BlockFieldType =
  | 'Text'
  | 'Number'
  | 'Select'
  | 'Date and Time'
  | 'Image'
  | 'Formatted Text'
  | 'Boolean'
  | 'CV Number'
  | 'Computer Vision'

export interface BlockFieldDefinition {
  label: string
  machineName: string
  type: BlockFieldType
  group?: string
  options?: string[]
  required?: boolean
  hidden?: boolean
  min?: number
  max?: number
  step?: number
  suffix?: string
  includeTime?: boolean
}

export interface Block {
  id: string
  farmId: string
  name: string
  description?: string
  variety?: string
  plantingYear?: number
  rowSpacing?: number
  vineSpacing?: number
  area: number // Square meters
  customFields?: BlockField[]
  createdAt: string
  updatedAt: string
  revisionMessage?: string
  updatedBy?: string
  updatedByName?: string
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

export interface CreateBlockInput {
  name: string
  description?: string
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
  variety?: string
  plantingYear?: number
  rowSpacing?: number
  vineSpacing?: number
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon
  customFields?: BlockField[]
  revisionMessage?: string
}
