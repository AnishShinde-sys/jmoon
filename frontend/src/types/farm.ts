export interface Farm {
  id: string
  name: string
  description?: string
  ownerId: string
  geolocation?: {
    latitude: number
    longitude: number
  }
  blocksGeoJsonPath?: string
  createdAt: string
  updatedAt: string
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
  geolocation?: {
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
