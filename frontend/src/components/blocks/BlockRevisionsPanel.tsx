"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import area from '@turf/area'
import type * as GeoJSON from 'geojson'
import type { Block, BlockRevision } from '@/types/block'

function formatTimestamp(timestamp: string) {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatAreaSqMeters(value?: number | null, measurementSystem: 'Metric' | 'Imperial' = 'Metric') {
  if (!value || Number.isNaN(value)) return '—'
  if (measurementSystem === 'Imperial') {
    const acres = value / 4046.8564224
    return `${acres.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac`
  }
  const hectares = value / 10_000
  return `${hectares.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`
}

interface BlockRevisionsPanelProps {
  block: Block
  measurementSystem?: 'Metric' | 'Imperial'
  loadRevisions: (blockId: string) => Promise<BlockRevision[]>
  onRevert: (revisionId: string, message?: string) => Promise<void>
  onPreview: (revision: BlockRevision | null) => void
  previewRevisionId?: string | null
  onClose: () => void
}

export default function BlockRevisionsPanel({
  block,
  measurementSystem = 'Metric',
  loadRevisions,
  onRevert,
  onPreview,
  previewRevisionId,
  onClose,
}: BlockRevisionsPanelProps) {
  const [revisions, setRevisions] = useState<BlockRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [revertMessage, setRevertMessage] = useState('')
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(previewRevisionId ?? null)

  const refreshRevisions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await loadRevisions(block.id)
      setRevisions(response)
    } catch (err: any) {
      setError(err?.message || 'Failed to load revisions')
    } finally {
      setLoading(false)
    }
  }, [block.id, loadRevisions])

  useEffect(() => {
    refreshRevisions()
  }, [refreshRevisions])

  useEffect(() => {
    setSelectedRevisionId(previewRevisionId ?? null)
  }, [previewRevisionId])

  const handleSelect = useCallback(
    (revision: BlockRevision) => {
      setSelectedRevisionId(revision.id)
      onPreview(revision)
    },
    [onPreview]
  )

  const handleClearPreview = useCallback(() => {
    setSelectedRevisionId(null)
    onPreview(null)
  }, [onPreview])

  const handleRevert = useCallback(
    async (revision: BlockRevision) => {
      try {
        setRevertingId(revision.id)
        await onRevert(revision.id, revertMessage.trim() || undefined)
        setRevertMessage('')
        setSelectedRevisionId(null)
        onPreview(null)
        await refreshRevisions()
      } catch (err: any) {
        setError(err?.message || 'Failed to revert to the selected revision')
      } finally {
        setRevertingId(null)
      }
    },
    [onRevert, revertMessage, refreshRevisions, onPreview]
  )

  const revisionSummaries = useMemo(() => {
    return revisions.map((revision) => {
      const revisionArea = (() => {
        if (!revision.geometry) return null
        try {
          const feature = {
            type: 'Feature',
            geometry: revision.geometry as GeoJSON.Geometry,
            properties: {},
          }
          return area(feature as any)
        } catch {
          return null
        }
      })()

      return {
        id: revision.id,
        timestamp: revision.createdAt,
        author: revision.updatedByName || revision.updatedBy || 'Unknown user',
        message: revision.revisionMessage,
        areaSqMeters: revisionArea,
        raw: revision,
      }
    })
  }, [revisions])

  return (
    <div className="space-y-3 rounded-lg border border-primary-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Revision History</h3>
          <p className="text-xs text-gray-500">Review previous versions, preview them on the map, or restore a revision.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            handleClearPreview()
            onClose()
          }}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
        >
          Done
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="revision-note-input">
          Revert message (optional)
        </label>
        <input
          id="revision-note-input"
          type="text"
          value={revertMessage}
          onChange={(event) => setRevertMessage(event.target.value)}
          placeholder="Describe why you are reverting…"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="spinner" aria-label="Loading block revisions" />
        </div>
      )}

      {!loading && revisionSummaries.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
          This block does not have any revisions yet.
        </div>
      )}

      {!loading && revisionSummaries.length > 0 && (
        <ul className="space-y-2">
          {revisionSummaries.map((revision) => {
            const isSelected = selectedRevisionId === revision.id
            return (
              <li
                key={revision.id}
                className={`rounded-md border ${
                  isSelected ? 'border-primary-400 bg-primary-50/80' : 'border-gray-200 bg-white'
                } px-3 py-3 shadow-sm transition`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{formatTimestamp(revision.timestamp)}</p>
                    <p className="text-xs text-gray-500">{revision.author}</p>
                    {revision.message && <p className="text-sm text-gray-700">{revision.message}</p>}
                    <p className="text-xs text-gray-500">
                      Area:{' '}
                      <span className="font-medium text-gray-700">
                        {formatAreaSqMeters(revision.areaSqMeters || undefined, measurementSystem)}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => (isSelected ? handleClearPreview() : handleSelect(revision.raw))}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                        isSelected
                          ? 'border-primary-500 text-primary-600'
                          : 'border-gray-200 text-gray-700 hover:border-primary-400 hover:text-primary-600'
                      }`}
                    >
                      {isSelected ? 'Stop Preview' : 'Preview on Map'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevert(revision.raw)}
                      disabled={Boolean(revertingId)}
                      className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary-500 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {revertingId === revision.id ? 'Reverting…' : 'Revert to Revision'}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
