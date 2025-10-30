"use client"

import { useMemo, useState } from 'react'
import { CalendarIcon, DocumentArrowDownIcon, MapIcon, UserIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import { Dataset } from '@/types/dataset'
import apiClient from '@/lib/apiClient'

const DRAWER_NAME = 'datasetDetails'

interface DrawerState {
  dataset?: Dataset
  [key: string]: any
}

export default function DatasetDetailsDrawer() {
  const { drawers, closeDrawer, openDrawer, showAlert } = useUI()

  const dataset = (drawers[DRAWER_NAME] as DrawerState | Dataset | undefined) as Dataset | undefined

  const [rebuilding, setRebuilding] = useState(false)

  const processingLabel = useMemo(() => {
    const status = dataset?.processing?.status
    if (!status) return null
    switch (status) {
      case 'pending':
        return 'Awaiting rebuild'
      case 'processing':
        return 'Rebuilding from collector'
      case 'completed':
        return 'Up to date'
      case 'failed':
        return 'Rebuild failed'
      default:
        return null
    }
  }, [dataset?.processing?.status])

  const processingUpdatedAt = useMemo(() => {
    if (!dataset?.processing?.updatedAt) return null
    return new Date(dataset.processing.updatedAt)
  }, [dataset?.processing?.updatedAt])

  const createdAt = useMemo(() => {
    if (!dataset?.createdAt) return null
    return new Date(dataset.createdAt)
  }, [dataset?.createdAt])

  const updatedAt = useMemo(() => {
    if (!dataset?.updatedAt) return null
    return new Date(dataset.updatedAt)
  }, [dataset?.updatedAt])

  const headerList = useMemo(() => {
    if (!dataset) return []
    if (Array.isArray(dataset.headers) && dataset.headers.length > 0) {
      return dataset.headers
    }
    if (Array.isArray(dataset.originalHeaders) && dataset.originalHeaders.length > 0) {
      return dataset.originalHeaders
    }
    if (Array.isArray((dataset as any).fields) && (dataset as any).fields.length > 0) {
      return (dataset as any).fields as string[]
    }
    return []
  }, [dataset])

  const handleLaunchDataset = () => {
    if (!dataset) return

    window.dispatchEvent(new CustomEvent('launchDataset', { detail: dataset }))
    showAlert(`Launching “${dataset.name}” on the map.`, 'success')
  }

  const handleDownload = () => {
    if (!dataset) return

    const downloadUrl = (dataset as any).downloadUrl
    if (downloadUrl) {
      window.open(downloadUrl, '_blank')
    } else {
      showAlert('A download link is not available yet for this dataset.', 'warning')
    }
  }

  const handleOpenCollector = () => {
    if (!dataset?.collectorId) {
      showAlert('This dataset is not linked to a collector.', 'info')
      return
    }

    openDrawer('collectorPreview', {
      collectorId: dataset.collectorId,
      dataset,
    })
  }

  const handleRebuildDataset = async () => {
    if (!dataset) return
    if (!dataset.collectorId) {
      showAlert('Link this dataset to a collector before rebuilding.', 'info')
      return
    }

    setRebuilding(true)
    try {
      showAlert(`Rebuilding “${dataset.name}” from collector data…`, 'info')
      const response = await apiClient.post(`/api/farms/${dataset.farmId}/datasets/${dataset.id}/rebuild`)
      const rebuilt = response.data as Dataset

      showAlert('Dataset rebuilt with the latest collector data.', 'success')
      window.dispatchEvent(new CustomEvent('datasetRecompiled', { detail: { dataset: rebuilt } }))
      window.dispatchEvent(new CustomEvent('datasets:refresh', { detail: { farmId: dataset.farmId } }))
      window.dispatchEvent(new CustomEvent('collectors:refresh', { detail: { farmId: dataset.farmId } }))
      openDrawer(DRAWER_NAME, rebuilt)
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to rebuild dataset'
      showAlert(message, 'error')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <Drawer
      isOpen={!!dataset}
      title={dataset ? dataset.name : 'Dataset'}
      onClose={() => closeDrawer(DRAWER_NAME)}
      position="left"
      showBackdrop={false}
    >
      {!dataset ? (
        <div className="py-8 text-sm text-gray-500">Select a dataset to view its details.</div>
      ) : (
        <div className="space-y-4 text-sm text-gray-700">
          {dataset.description && (
            <p className="text-gray-600">{dataset.description}</p>
          )}

          <div className="grid grid-cols-1 gap-3 border-t border-gray-200 pt-3">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <CalendarIcon className="w-4 h-4" />
              <span>Created {createdAt ? createdAt.toLocaleString() : '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <CalendarIcon className="w-4 h-4" />
              <span>Updated {updatedAt ? updatedAt.toLocaleString() : '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <UserIcon className="w-4 h-4" />
              <span>Created by {(dataset as any).createdByName || dataset.createdBy || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <MapIcon className="w-4 h-4" />
              <span>{((dataset as any).recordCount as number | undefined) ?? 0} records</span>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase text-gray-500 mb-2">Headers</p>
            <div className="flex flex-wrap gap-2">
              {headerList.length ? (
                headerList.map((header) => (
                  <span
                    key={header}
                    className="inline-flex items-center border border-gray-200 rounded-full px-2 py-0.5 text-xs"
                  >
                    {header}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">No headers specified.</span>
              )}
            </div>
          </div>

          {dataset.dynamic && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <p className="font-semibold text-blue-900">Linked Data Collector</p>
              <p className="mt-1 text-blue-700/80">
                Updates gathered via collector <span className="font-semibold">{dataset.collectorId}</span> can be merged into this
                dataset after a rebuild.
              </p>
            </div>
          )}

          {processingLabel && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold text-amber-900">Processing Status</p>
              <p className="mt-1">{processingLabel}</p>
              {dataset.processing?.message && <p className="mt-1 text-amber-700/90">{dataset.processing.message}</p>}
              {processingUpdatedAt && (
                <p className="mt-1 text-amber-700/70">Updated {processingUpdatedAt.toLocaleString()}</p>
              )}
            </div>
          )}

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <button
              onClick={handleLaunchDataset}
              className="w-full btn btn-primary flex items-center justify-center gap-2"
            >
              <MapIcon className="w-5 h-5" />
              Launch on Map
            </button>
            <button
              onClick={handleDownload}
              className="w-full btn btn-secondary flex items-center justify-center gap-2"
            >
              <DocumentArrowDownIcon className="w-5 h-5" />
              Download Source File
            </button>
            {dataset.collectorId && (
              <button
                onClick={handleRebuildDataset}
                disabled={rebuilding}
                className="w-full btn btn-secondary flex items-center justify-center gap-2 disabled:opacity-70"
              >
                <ArrowPathIcon className={`w-5 h-5 ${rebuilding ? 'animate-spin' : ''}`} />
                {rebuilding ? 'Rebuilding…' : 'Rebuild from Collector'}
              </button>
            )}
            {dataset.collectorId && (
              <button
                onClick={handleOpenCollector}
                className="w-full btn btn-secondary flex items-center justify-center gap-2"
              >
                Open Linked Collector
              </button>
            )}
            <button
              onClick={() => openDrawer('datasetRevisions', { dataset, farmId: dataset.farmId })}
              className="w-full btn btn-secondary flex items-center justify-center gap-2"
            >
              Revision History
            </button>
          </div>
        </div>
      )}
    </Drawer>
  )
}



