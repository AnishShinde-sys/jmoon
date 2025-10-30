import type { Feature, FeatureCollection } from 'geojson'

import apiClient from '@/lib/apiClient'

export interface FarmsGeoJsonResponse {
  geoJson: FeatureCollection | Feature
  updatedAt: string
}

export async function fetchFarmsGeoJson(): Promise<FarmsGeoJsonResponse> {
  const response = await apiClient.get<FarmsGeoJsonResponse>('/api/admin/exports/farms-geojson')
  return response.data
}

export async function downloadUsersCsv(): Promise<void> {
  const response = await apiClient.get('/api/admin/exports/users.csv', {
    responseType: 'blob',
  })

  const blob = new Blob([response.data], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'users.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}


