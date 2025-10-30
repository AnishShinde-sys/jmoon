export type MeasurementSystem = 'Metric' | 'Imperial'

export interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'user'
  name?: string
  firstName?: string
  lastName?: string
  company?: string
  organization?: string
  emailNotifications?: boolean
  measurementSystem?: MeasurementSystem
  defaultFarm?: string
  tosId?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserSettings {
  emailNotifications?: boolean
  measurementSystem?: MeasurementSystem
}
