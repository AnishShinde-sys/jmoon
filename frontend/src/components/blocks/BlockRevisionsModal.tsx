"use client"

import { useCallback, useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Block, BlockRevision } from '@/types/block'

interface BlockRevisionsModalProps {
  block: Block | null
  isOpen: boolean
  loadRevisions: (blockId: string) => Promise<BlockRevision[]>
  onRevert: (revisionId: string, message?: string) => Promise<void>
  onClose: () => void
}

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

export default function BlockRevisionsModal({ block, isOpen, loadRevisions, onRevert, onClose }: BlockRevisionsModalProps) {
  const [revisions, setRevisions] = useState<BlockRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [revertMessage, setRevertMessage] = useState<string>('')

  useEffect(() => {
    if (!isOpen || !block?.id) {
      return
    }

    let cancelled = false

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await loadRevisions(block.id)
        if (!cancelled) {
          setRevisions(response)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load revisions')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [block?.id, isOpen, loadRevisions])

  useEffect(() => {
    if (!isOpen) {
      setRevertMessage('')
      setRevertingId(null)
    }
  }, [isOpen])

  const handleRevert = useCallback(
    async (revisionId: string) => {
      if (!block?.id) return
      try {
        setRevertingId(revisionId)
        await onRevert(revisionId, revertMessage.trim() || undefined)
        const updated = await loadRevisions(block.id)
        setRevisions(updated)
        setRevertMessage('')
      } catch (err: any) {
        setError(err?.message || 'Failed to revert block revision')
      } finally {
        setRevertingId(null)
      }
    },
    [block?.id, loadRevisions, onRevert, revertMessage]
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={block ? `Revision History · ${block.name}` : 'Revision History'}
      size="xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="spinner" aria-label="Loading revisions" />
          </div>
        )}

        {!loading && revisions.length === 0 && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
            No revisions recorded yet for this block.
          </div>
        )}

        {!loading && revisions.length > 0 && (
          <div className="space-y-3">
            <div>
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">Revert message</span>
                <input
                  type="text"
                  value={revertMessage}
                  onChange={(event) => setRevertMessage(event.target.value)}
                  placeholder="Optional note to record with the revert"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </label>
            </div>
            <ul className="space-y-2">
              {revisions.map((revision) => (
                <li
                  key={revision.id}
                  className="rounded-md border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{formatTimestamp(revision.createdAt)}</p>
                      <p className="text-xs text-gray-500">
                        {revision.updatedByName || revision.updatedBy || 'Unknown user'}
                      </p>
                      {revision.revisionMessage && (
                        <p className="mt-1 text-sm text-gray-700">{revision.revisionMessage}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevert(revision.id)}
                      className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary-500 hover:text-primary-600"
                      disabled={Boolean(revertingId)}
                    >
                      {revertingId === revision.id ? 'Reverting…' : 'Revert to This Revision'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}

