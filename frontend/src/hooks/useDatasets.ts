import { useState, useEffect, useCallback } from 'react'
import { Dataset, CreateDatasetInput, UpdateDatasetInput } from '@/types/dataset'
import apiClient from '@/lib/apiClient'

export function useDatasets(farmId: string, folderId: string = 'root') {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDatasets = useCallback(async () => {
    if (!farmId) return

    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get(`/api/farms/${farmId}/datasets`, {
        params: { folderId },
      })
      setDatasets(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch datasets')
    } finally {
      setLoading(false)
    }
  }, [farmId, folderId])

  const uploadDataset = async (file: File, metadata: CreateDatasetInput) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', metadata.name)
    if (metadata.description) formData.append('description', metadata.description)
    if (metadata.folderId) formData.append('folderId', metadata.folderId)
     if (metadata.type) formData.append('type', metadata.type)
     if (metadata.columnMapping) formData.append('columnMapping', JSON.stringify(metadata.columnMapping))
     if (metadata.originalHeaders) formData.append('originalHeaders', JSON.stringify(metadata.originalHeaders))

    const response = await apiClient.post(`/api/farms/${farmId}/datasets/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    await fetchDatasets()
    return response.data
  }

  const updateDataset = async (
    datasetId: string,
    input: UpdateDatasetInput,
    options?: { revisionMessage?: string }
  ): Promise<Dataset> => {
    const payload: UpdateDatasetInput & { revisionMessage?: string } = {
      ...input,
    }

    if (options?.revisionMessage) {
      payload.revisionMessage = options.revisionMessage
    }

    const response = await apiClient.put(`/api/datasets/${datasetId}`, payload, {
      params: { farmId },
    })
    const updated = response.data
    setDatasets((prev) => prev.map((d) => (d.id === datasetId ? updated : d)))
    return updated
  }

  const deleteDataset = async (datasetId: string): Promise<void> => {
    await apiClient.delete(`/api/datasets/${datasetId}`, {
      params: { farmId },
    })
    setDatasets((prev) => prev.filter((d) => d.id !== datasetId))
  }

  const copyDataset = async (datasetId: string, newName: string) => {
    const response = await apiClient.post(
      `/api/datasets/${datasetId}/copy`,
      { newName },
      {
        params: { farmId },
      }
    )
    await fetchDatasets()
    return response.data
  }

  useEffect(() => {
    fetchDatasets()
  }, [fetchDatasets])

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ farmId?: string }>).detail
      if (!detail?.farmId || detail.farmId === farmId) {
        fetchDatasets()
      }
    }

    window.addEventListener('datasets:refresh', handleRefresh as EventListener)
    return () => {
      window.removeEventListener('datasets:refresh', handleRefresh as EventListener)
    }
  }, [farmId, fetchDatasets])

  return {
    datasets,
    loading,
    error,
    refetch: fetchDatasets,
    uploadDataset,
    updateDataset,
    deleteDataset,
    copyDataset,
  }
}
