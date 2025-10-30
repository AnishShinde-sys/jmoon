import { useCallback, useEffect, useState } from 'react'
import apiClient from '@/lib/apiClient'
import { DatasetFolder } from '@/types/dataset'

export function useDatasetFolders(farmId: string) {
  const [folders, setFolders] = useState<DatasetFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFolders = useCallback(async () => {
    if (!farmId) return

    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get<DatasetFolder[]>(`/api/farms/${farmId}/dataset-folders`)
      setFolders(response.data || [])
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load dataset folders')
    } finally {
      setLoading(false)
    }
  }, [farmId])

  const createFolder = useCallback(
    async (name: string, options: { description?: string; parentId?: string } = {}) => {
      if (!farmId) return null

      const response = await apiClient.post<DatasetFolder>(`/api/farms/${farmId}/dataset-folders`, {
        name,
        description: options.description,
        parentId: options.parentId || 'root',
      })

      setFolders((prev) => [...prev, response.data])
      return response.data
    },
    [farmId]
  )

  const updateFolder = useCallback(
    async (folderId: string, updates: Partial<DatasetFolder>) => {
      if (!farmId) return null

      const response = await apiClient.put<DatasetFolder>(
        `/api/farms/${farmId}/dataset-folders/${folderId}`,
        updates
      )

      setFolders((prev) => prev.map((folder) => (folder.id === folderId ? response.data : folder)))
      return response.data
    },
    [farmId]
  )

  const deleteFolder = useCallback(
    async (folderId: string) => {
      if (!farmId) return

      await apiClient.delete(`/api/farms/${farmId}/dataset-folders/${folderId}`)
      setFolders((prev) => prev.filter((folder) => folder.id !== folderId))
    },
    [farmId]
  )

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  return {
    folders,
    loading,
    error,
    refetch: fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
  }
}

