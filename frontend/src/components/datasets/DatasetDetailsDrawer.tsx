"use client"

import { useMemo } from 'react'
import { CalendarIcon, DocumentArrowDownIcon, MapIcon, UserIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import { Dataset } from '@/types/dataset'

const DRAWER_NAME = 'datasetDetails'

interface DrawerState {
  dataset?: Dataset
  [key: string]: any
}

export default function DatasetDetailsDrawer() {
  const { drawers, closeDrawer, openDrawer, showAlert } = useUI()

  const dataset = (drawers[DRAWER_NAME] as DrawerState | Dataset | undefined) as Dataset | undefined

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
    showAlert('Dataset launch events are wired. Hook up the handler in MapContext to finish the flow.', 'info')
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



