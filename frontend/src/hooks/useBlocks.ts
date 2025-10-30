import { useState, useEffect } from 'react'
import { Block, CreateBlockInput, UpdateBlockInput } from '@/types/block'
import apiClient from '@/lib/apiClient'

export function useBlocks(farmId: string) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [blocksGeoJSON, setBlocksGeoJSON] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBlocks = async () => {
    if (!farmId) return

    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get(`/api/farms/${farmId}/blocks`)
      // Response is GeoJSON FeatureCollection
      setBlocksGeoJSON(response.data)
      // Extract blocks from features
      if (response.data.features) {
        setBlocks(
          response.data.features.map((f: any) => ({
            ...(f.properties || {}),
            geometry: f.geometry,
          }))
        )
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch blocks')
    } finally {
      setLoading(false)
    }
  }

  const createBlock = async (input: CreateBlockInput): Promise<Block> => {
    const response = await apiClient.post(`/api/farms/${farmId}/blocks`, input)
    await fetchBlocks() // Refetch to get updated compiled GeoJSON
    return response.data
  }

  const updateBlock = async (blockId: string, input: UpdateBlockInput): Promise<Block> => {
    const response = await apiClient.put(`/api/farms/${farmId}/blocks/${blockId}`, input)
    await fetchBlocks()
    return response.data
  }

  const deleteBlock = async (blockId: string): Promise<void> => {
    await apiClient.delete(`/api/farms/${farmId}/blocks/${blockId}`)
    await fetchBlocks()
  }

  const compileBlocks = async (): Promise<void> => {
    await apiClient.post(`/api/farms/${farmId}/blocks/compile`)
    await fetchBlocks()
  }

  useEffect(() => {
    fetchBlocks()
  }, [farmId])

  return {
    blocks,
    blocksGeoJSON,
    loading,
    error,
    refetch: fetchBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
    compileBlocks,
  }
}
