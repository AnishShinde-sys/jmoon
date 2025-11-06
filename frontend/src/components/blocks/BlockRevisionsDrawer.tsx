"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUturnLeftIcon, ClockIcon, CloudArrowDownIcon, EyeIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'
import { Block } from '@/types/block'
interface BlockRevision {
  id: string
  updatedAt?: string
  updatedOn?: string
  updatedBy?: string
  updatedByName?: string
  revisionMessage?: string
  createdAt?: string
  geometry?: GeoJSON.Geometry
  properties?: Block
  [key: string]: any
}

const DRAWER_NAME = 'blockRevisions'

interface BlockRevisionsDrawerProps {
  farmId: string
  onOpenBlockEditor?: (state: { mode: 'create' | 'edit'; block?: Block | null; blockId?: string | number }) => void
}

export default function BlockRevisionsDrawer({ farmId, onOpenBlockEditor }: BlockRevisionsDrawerProps) {
  const { drawers, closeDrawer, openDrawer, showAlert } = useUI()
  const [block, setBlock] = useState<Block | null>(null)
  const [revisions, setRevisions] = useState<BlockRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isReverting, setIsReverting] = useState(false)

  const blockId = (typeof drawers[DRAWER_NAME] === 'string' || typeof drawers[DRAWER_NAME] === 'number')
    ? String(drawers[DRAWER_NAME])
    : undefined

  const loadRevisions = useCallback(async () => {
    if (!farmId || !blockId) return

    setLoading(true)
    setError(null)

    try {
      const featureResponse = await apiClient.get(`/api/farms/${farmId}/blocks/${blockId}`)
      const feature = featureResponse.data
      const blockData = {
        ...(feature.properties || feature),
        geometry: feature.geometry,
      }
      setBlock(blockData)

      const revisionsResponse = await apiClient.get(`/api/farms/${farmId}/blocks/${blockId}/revisions`)
      const items = Array.isArray(revisionsResponse.data) ? revisionsResponse.data : []
      setRevisions(items)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load revisions')
    } finally {
      setLoading(false)
    }
  }, [farmId, blockId])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!cancelled) {
        await loadRevisions()
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [loadRevisions])

  const handleClose = () => {
    if (blockId) {
      closeDrawer(DRAWER_NAME)
      setTimeout(() => {
        if (block) {
          onOpenBlockEditor?.({ mode: 'edit', block: { ...block }, blockId })
        } else {
          onOpenBlockEditor?.({ mode: 'edit', blockId })
        }
      }, 150)
    } else {
      closeDrawer(DRAWER_NAME)
    }
  }

  const handlePreview = (revision: BlockRevision) => {
    openDrawer('blockRevisionPreview', { block, revision })
  }

  const handleRevert = async (revision: BlockRevision) => {
    if (!farmId || !blockId) {
      return
    }

    const confirmed = window.confirm('Revert this block to the selected revision? This will overwrite the current geometry and properties.')
    if (!confirmed) {
      return
    }

    const note = window.prompt('Optional: Add a note for this revert', '')

    setIsReverting(true)
    try {
      const response = await apiClient.post(`/api/farms/${farmId}/blocks/${blockId}/revisions/${revision.id}/revert`, {
        revisionMessage: note?.trim() ? note.trim() : undefined,
      })

      const feature = response.data
      const updatedBlock = {
        ...(feature.properties || feature),
        geometry: feature.geometry,
      }
      setBlock(updatedBlock)
      showAlert('Block reverted successfully', 'success')
      await loadRevisions()
      onOpenBlockEditor?.({ mode: 'edit', block: updatedBlock, blockId })
    } catch (error: any) {
      showAlert(error?.response?.data?.message || 'Failed to revert block', 'error')
    } finally {
      setIsReverting(false)
    }
  }

  const formattedRevisions = useMemo(() => {
    if (!block) {
      return []
    }

    const normalizedHistory = revisions.map((revision) => {
      const properties = revision.properties || {}
      return {
        ...revision,
        updatedAt: revision.updatedAt || (properties as any).updatedAt,
        updatedOn: revision.updatedOn || (properties as any).updatedOn,
        updatedByName: revision.updatedByName || (properties as any).updatedByName,
        revisionMessage: revision.revisionMessage || (properties as any).revisionMessage,
      }
    })

    const latest: BlockRevision = {
      id: block.id,
      updatedAt: block.updatedAt,
      updatedOn: (block as any).updatedOn,
      updatedByName: block.updatedByName,
      revisionMessage: block.revisionMessage || 'Current version',
      geometry: block.geometry as any,
      properties: block,
    }

    return [latest, ...normalizedHistory]
  }, [block, revisions])

  const handleDownloadCsv = () => {
    if (!block) {
      return
    }

    const dataRows = formattedRevisions.map((item) => {
      const properties = item.properties || {}
      return {
        id: item.id,
        createdAt: item.createdAt || (properties as any).createdAt || '',
        updatedAt: item.updatedAt || (properties as any).updatedAt || '',
        updatedBy: item.updatedBy || (properties as any).updatedBy || '',
        updatedByName: item.updatedByName || (properties as any).updatedByName || '',
        revisionMessage: item.revisionMessage || (properties as any).revisionMessage || '',
      }
    })

    if (dataRows.length === 0) {
      showAlert('Nothing to export yet.', 'info')
      return
    }

    const headers = Object.keys(dataRows.reduce((acc, row) => ({ ...acc, ...row }), {}))
    const csv = [headers.join(',')]

    dataRows.forEach((row) => {
      const values = headers.map((header) => {
        const value = (row as any)[header] ?? ''
        if (typeof value === 'string') {
          const escaped = value.replace(/"/g, '""')
          return value.includes(',') ? `"${escaped}"` : escaped
        }
        if (value instanceof Date) {
          return value.toISOString()
        }
        return value
      })

      csv.push(values.join(','))
    })

    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${timestamp}_${(block.name || 'block').replace(/\s+/g, '_')}_revisions.csv`
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
      isOpen={!!blockId}
      title={block ? `${block.name} · Revisions` : 'Block Revisions'}
      onClose={handleClose}
      position="right"
      showBackdrop={false}
    >
      {loading ? (
        <div className="py-8 flex flex-col items-center gap-3 text-gray-500">
          <div className="spinner" />
          <p className="text-sm">Loading revisions…</p>
        </div>
      ) : error ? (
        <div className="py-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <CloudArrowDownIcon className="w-4 h-4" />
              Download CSV
            </button>
            <button
              onClick={handleClose}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
              Back
            </button>
          </div>

          <div className="space-y-3">
            {formattedRevisions.map((revision, index) => (
              <div
                key={`${revision.id}-${index}`}
                className={`border rounded-md p-3 ${index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900">
                      {index === 0 ? 'Current Version' : `Revision #${index}`}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 gap-1">
                      <ClockIcon className="w-4 h-4" />
                      <span>
                        {(() => {
                          const timestamp = revision.updatedOn || revision.updatedAt || revision.createdAt
                          return timestamp ? new Date(timestamp).toLocaleString() : 'Unknown'
                        })()}
                      </span>
                    </div>
                    {revision.updatedByName && (
                      <p className="text-xs text-gray-500">by {revision.updatedByName}</p>
                    )}
                  </div>
                  {index !== 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreview(revision)}
                        className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 flex items-center gap-1"
                      >
                        <EyeIcon className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        onClick={() => handleRevert(revision)}
                        className="px-2 py-1 text-xs border border-yellow-300 text-yellow-700 rounded hover:bg-yellow-50 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isReverting}
                      >
                        Revert
                      </button>
                    </div>
                  )}
                </div>
                {revision.revisionMessage && (
                  <p className="text-xs text-gray-600 mt-2">{revision.revisionMessage}</p>
                )}
              </div>
            ))}

            {formattedRevisions.length <= 1 && (
              <p className="text-xs text-gray-500">Revisions will appear here once changes are recorded.</p>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}


