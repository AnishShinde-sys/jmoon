import { useState, useEffect } from 'react'
import { Farm, CreateFarmInput, UpdateFarmInput } from '@/types/farm'
import apiClient from '@/lib/apiClient'

export function useFarms() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFarms = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get('/api/farms')
      setFarms(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch farms')
    } finally {
      setLoading(false)
    }
  }

  const createFarm = async (input: CreateFarmInput): Promise<Farm> => {
    const response = await apiClient.post('/api/farms', input)
    const newFarm = response.data
    setFarms((prev) => [...prev, newFarm])
    return newFarm
  }

  const updateFarm = async (farmId: string, input: UpdateFarmInput): Promise<Farm> => {
    const response = await apiClient.put(`/api/farms/${farmId}`, input)
    const updatedFarm = response.data
    setFarms((prev) => prev.map((f) => (f.id === farmId ? updatedFarm : f)))
    return updatedFarm
  }

  const deleteFarm = async (farmId: string): Promise<void> => {
    await apiClient.delete(`/api/farms/${farmId}`)
    setFarms((prev) => prev.filter((f) => f.id !== farmId))
  }

  useEffect(() => {
    fetchFarms()
  }, [])

  return {
    farms,
    loading,
    error,
    refetch: fetchFarms,
    createFarm,
    updateFarm,
    deleteFarm,
  }
}
