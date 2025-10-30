"use client"

import { useEffect, useMemo, useState } from 'react'
import apiClient from '@/lib/apiClient'
import type { Dataset } from '@/types/dataset'

export interface LaunchOptions {
  autoZoom: boolean
  openDetails: boolean
  clearExistingLayers: boolean
}

interface DatasetLaunchConfirmModalProps {
  farmId: string
  dataset: Dataset
  onConfirm: (options: LaunchOptions, datasetDetails?: Dataset) => void
  onCancel: () => void
}

const defaultOptions: LaunchOptions = {
  autoZoom: true,
  openDetails: true,
  clearExistingLayers: true,
}

export default function DatasetLaunchConfirmModal({
  farmId,
  dataset,
  onConfirm,
  onCancel,
}: DatasetLaunchConfirmModalProps) {
  const [options, setOptions] = useState<LaunchOptions>(defaultOptions)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datasetDetails, setDatasetDetails] = useState<Dataset | null>(null)

  useEffect(() => {
    let ignore = false
    const loadDetails = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await apiClient.get<Dataset>(`/api/datasets/${dataset.id}`, {
          params: { farmId },
        })
        if (!ignore) {
          setDatasetDetails(response.data)
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err?.response?.data?.message || 'Unable to load dataset details')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadDetails()
    return () => {
      ignore = true
    }
  }, [dataset.id, farmId])

  const recordCount = useMemo(() => {
    if (datasetDetails && typeof (datasetDetails as any).recordCount === 'number') {
      return (datasetDetails as any).recordCount as number
    }
    if (typeof (dataset as any).recordCount === 'number') {
      return (dataset as any).recordCount as number
    }
    return undefined
  }, [dataset, datasetDetails])

  const createdAt = datasetDetails?.createdAt || dataset.createdAt
  const updatedAt = datasetDetails?.updatedAt || dataset.updatedAt

  const handleOptionChange = (key: keyof LaunchOptions) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setOptions((prev) => ({ ...prev, [key]: event.target.checked }))
  }

  const handleConfirm = () => {
    onConfirm(options, datasetDetails || dataset)
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Launch dataset on map?</h3>
          <p className="text-sm text-gray-500">Launching a dataset will replace the active dataset layers on the farm map.</p>
        </div>

        <div className="space-y-4 px-6 py-5 text-sm text-gray-700">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-base font-medium text-gray-900">{dataset.name}</p>
            {dataset.description && (
              <p className="mt-1 text-sm text-gray-600">{dataset.description}</p>
            )}
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-500 sm:grid-cols-2">
              {recordCount !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-600">Records</span>
                  <span>{recordCount}</span>
                </div>
              )}
              {createdAt && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-600">Created</span>
                  <span>{new Date(createdAt).toLocaleString()}</span>
                </div>
              )}
              {updatedAt && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-600">Updated</span>
                  <span>{new Date(updatedAt).toLocaleString()}</span>
                </div>
              )}
            </dl>
            {loading && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <div className="spinner h-3 w-3" /> Fetching latest details…
              </div>
            )}
            {error && (
              <p className="mt-3 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={options.autoZoom}
                onChange={handleOptionChange('autoZoom')}
              />
              <span>
                <span className="font-medium text-gray-800">Auto-zoom to dataset extent</span>
                <span className="block text-xs text-gray-500">Fits the map view to the dataset bounds after launch.</span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={options.openDetails}
                onChange={handleOptionChange('openDetails')}
              />
              <span>
                <span className="font-medium text-gray-800">Open dataset details after launching</span>
                <span className="block text-xs text-gray-500">Keeps the dataset details drawer visible for quick visualization tweaks.</span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={options.clearExistingLayers}
                onChange={handleOptionChange('clearExistingLayers')}
              />
              <span>
                <span className="font-medium text-gray-800">Clear existing dataset layers</span>
                <span className="block text-xs text-gray-500">Removes previously launched dataset layers before rendering this dataset.</span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-primary"
          >
            Launch Dataset
          </button>
        </div>
      </div>
    </div>
  )
}

