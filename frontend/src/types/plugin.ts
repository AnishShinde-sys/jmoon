export interface PluginDefinition {
  id: string
  name: string
  description: string
  url: string
  category?: string
  icon?: string
  appendFarmId?: boolean
  authRequired?: boolean
}

export interface PluginStateResponse {
  enabled: string[]
}

