export interface VizSettings {
  colorOpacity: number
  colorBy: 'solid' | 'valueBased'
  blockColor: string
  labelBy: 'noLabel' | 'blockName' | 'headerValue'
  labelHeader?: any
  colorHeader?: any
  colors?: string[]
  zoneClassification?: string
  zoneStops?: number
}

export interface Farm {
  id: string
  name: string
  description?: string
  ownerId?: string
  owner?: string
  geolocation?: {
    latitude: number
    longitude: number
  }
  blocksGeoJsonPath?: string
  vizSettings?: VizSettings
  createdAt: string
  updatedAt: string
  users?: Array<{ id: string }>
  permissions?: Record<string, 'Administrator' | 'Editor' | 'Read-only'>
  plugins?: string[]
}

export interface FarmCollaborator {
  userId: string
  email: string
  role: 'owner' | 'editor' | 'viewer'
  addedAt: string
}

export interface CreateFarmInput {
  name: string
  description?: string
  location?: {
    latitude: number
    longitude: number
  }
}

export interface UpdateFarmInput {
  name?: string
  description?: string
  geolocation?: {
    latitude: number
    longitude: number
  }
}
