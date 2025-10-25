export interface User {
  id: string
  email: string
  displayName?: string
  emailNotifications: boolean
  createdAt: string
  updatedAt: string
}

export interface UserSettings {
  emailNotifications: boolean
  theme: 'light' | 'dark' | 'system'
  mapStyle: string
}
