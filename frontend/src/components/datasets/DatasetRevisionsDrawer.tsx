"use client"

import { useEffect, useMemo, useState } from 'react'
import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'
import { Dataset, DatasetRevision } from '@/types/dataset'

const DRAWER_NAME = 'datasetRevisions'

interface DrawerPayload {
  dataset?: Dataset
  farmId?: string
}

export default function DatasetRevisionsDrawer() {
  const { drawers, closeDrawer, openDrawer, showAlert } = useUI()
  const payload = (drawers[DRAWER_NAME] as DrawerPayload | undefined) || {}
  const dataset = payload.dataset
  const farmId = payload.farmId

  const [revisions, setRevisions] = useState<DatasetRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!dataset?.id || !farmId) {
      return
    }

    let cancelled = false

    const loadRevisions = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await apiClient.get<DatasetRevision[]>(
          `/api/farms/${farmId}/datasets/${dataset.id}/revisions`
        )
        if (!cancelled) {
          setRevisions(response.data)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load dataset revisions')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadRevisions()

    return () => {
      cancelled = true
    }
  }, [dataset?.id, farmId])

  const combinedRevisions = useMemo(() => {
    if (!dataset) {
      return []
    }

    const currentSnapshot: DatasetRevision = {
      id: dataset.id,
      datasetId: dataset.id,
      farmId: dataset.farmId,
      createdAt: dataset.updatedAt || dataset.createdAt || new Date().toISOString(),
      updatedBy: dataset.createdBy || 'system',
      updatedByName: undefined,
      revisionMessage: 'Current version',
      snapshot: dataset,
    }

    return [currentSnapshot, ...revisions]
  }, [dataset, revisions])

  const handleClose = () => {
    closeDrawer(DRAWER_NAME)
  }

  const handleViewDetails = (revision: DatasetRevision) => {
    openDrawer('datasetDetails', revision.snapshot)
  }

  const handleDownloadCsv = () => {
    if (!combinedRevisions.length) {
      showAlert('Nothing to export yet.', 'info')
      return
    }

    const rows = combinedRevisions.map((revision) => ({
      id: revision.id,
      datasetId: revision.datasetId,
      farmId: revision.farmId,
      updatedAt: revision.createdAt,
      updatedBy: revision.updatedBy,
      updatedByName: revision.updatedByName || '',
      revisionMessage: revision.revisionMessage || '',
    }))

    const headers = Object.keys(rows[0])
    const csv = [headers.join(',')]

    rows.forEach((row) => {
      const values = headers.map((key) => {
        const value = (row as any)[key] ?? ''
        if (typeof value === 'string') {
          const escaped = value.replace(/"/g, '""')
          return value.includes(',') ? `"${escaped}"` : escaped
        }
        return value
      })
      csv.push(values.join(','))
    })

    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const filename = `${dataset?.name?.replace(/\s+/g, '_') || 'dataset'}_revisions.csv`
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Drawer
      isOpen={Boolean(dataset)}
      title={dataset ? `${dataset.name} · Revisions` : 'Dataset Revisions'}
      onClose={handleClose}
      position="left"
      showBackdrop={false}
    >
      {!dataset ? (
        <div className="py-6 text-sm text-gray-500">Select a dataset to view its revision history.</div>
      ) : loading ? (
        <div className="flex flex-col items-center gap-2 py-10 text-sm text-gray-500">
          <span className="spinner" />
          Loading revisions…
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between text-xs">
            <button
              onClick={handleDownloadCsv}
              className="text-blue-600 hover:text-blue-700"
            >
              Download CSV
            </button>
          </div>

          {combinedRevisions.length === 0 ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No revisions have been recorded for this dataset yet.
            </div>
          ) : (
            <div className="space-y-3">
              {combinedRevisions.map((revision) => (
                <div
                  key={revision.id}
                  className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700"
                >
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(revision.createdAt).toLocaleString()}</span>
                    <span>{revision.updatedByName || revision.updatedBy}</span>
                  </div>
                  {revision.revisionMessage && (
                    <p className="mt-2 text-sm text-gray-800">{revision.revisionMessage}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleViewDetails(revision)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      View Snapshot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

