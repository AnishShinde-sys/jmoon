export interface BlockField {
  label: string
  machine_name: string
  type: 'Text' | 'Number' | 'Select' | 'Date and Time'
  options?: string[]
}

export interface Block {
  id: string
  farmId: string
  name: string
  description?: string
  footprint: string // GeoJSON string
  area: number // Square meters
  hectares: number
  acres: number
  customFields?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface CreateBlockInput {
  farmId: string
  name: string
  description?: string
  footprint: string // GeoJSON string
  customFields?: Record<string, any>
}

export interface UpdateBlockInput {
  name?: string
  description?: string
  footprint?: string
  customFields?: Record<string, any>
}
