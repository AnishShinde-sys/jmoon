"use client"

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Feature } from 'geojson'
import {
  ArrowsUpDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  MapIcon,
  PlusSmallIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

import type { Block, BlockFieldDefinition } from '@/types/block'
import type { MeasurementSystem } from '@/types/user'

interface BlockListProps {
  blocks: Feature[]
  blockEntities: Block[]
  blockFields?: BlockFieldDefinition[]
  measurementSystem?: MeasurementSystem
  loading?: boolean
  onCreateBlocks?: () => void
  isCreatingBlock?: boolean
  selectedBlockId?: string | null
  onOpenBlockDetails?: (blockId: string) => void
  onEditBlock?: (blockId: string) => void
  onDeleteBlocks?: (blockIds: string[]) => Promise<void> | void
  onBulkUpdate?: (field: BlockFieldDefinition, value: unknown, blockIds: string[]) => Promise<void> | void
  onRequestSelectOnMap?: () => void
  onRefresh?: () => Promise<void> | void
}

interface BlockRow {
  id: string
  name: string
  area?: number
  variety?: string
  updatedAt?: string
  feature?: Feature | null
}

function getBlockId(feature: Feature): string | null {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const raw = feature.id ?? props.id ?? props.blockId
  if (raw === undefined || raw === null) return null
  return String(raw)
}

function formatArea(area: number | undefined, measurementSystem?: MeasurementSystem) {
  if (typeof area !== 'number' || Number.isNaN(area)) return '—'
  const value = measurementSystem === 'Imperial' ? area * 0.000247105 : area / 10_000
  const unit = measurementSystem === 'Imperial' ? 'ac' : 'ha'
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
}

function formatUpdatedAt(updatedAt?: string) {
  if (!updatedAt) return '—'
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function BlockList({
  blocks,
  blockEntities,
  blockFields,
  measurementSystem,
  loading,
  onCreateBlocks,
  isCreatingBlock,
  selectedBlockId,
  onOpenBlockDetails,
  onEditBlock,
  onDeleteBlocks,
  onBulkUpdate,
  onRequestSelectOnMap,
  onRefresh,
}: BlockListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])
  const [sortAscending, setSortAscending] = useState(true)

  const featureById = useMemo(() => {
    const map = new Map<string, Feature>()
    blocks.forEach((feature) => {
      const blockId = getBlockId(feature)
      if (blockId) {
        map.set(blockId, feature)
      }
    })
    return map
  }, [blocks])

  const rows = useMemo<BlockRow[]>(() => {
    if (blockEntities.length) {
      return blockEntities.map((block) => ({
        id: block.id,
        name: block.name || 'Unnamed Block',
        area: block.area,
        variety: block.variety,
        updatedAt: block.updatedAt,
        feature: featureById.get(block.id) ?? null,
      }))
    }

    return blocks
      .map((feature) => {
        const blockId = getBlockId(feature)
        if (!blockId) return null
        const props = (feature.properties ?? {}) as Record<string, any>
        return {
          id: blockId,
          name: props.name || 'Unnamed Block',
          area: typeof props.area === 'number' ? props.area : undefined,
          variety: props.variety,
          updatedAt: props.updatedAt,
          feature,
        }
      })
      .filter(Boolean) as BlockRow[]
  }, [blockEntities, blocks, featureById])

  const filteredRows = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase()
    const base = [...rows].sort((a, b) => {
      const result = a.name.localeCompare(b.name)
      return sortAscending ? result : -result
    })

    if (!normalizedTerm) return base

    return base.filter((row) => row.name.toLowerCase().includes(normalizedTerm))
  }, [rows, searchTerm, sortAscending])

  const toggleSelection = (blockId: string) => {
    setSelectedBlockIds((prev) =>
      prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId]
    )
  }

  const handleDelete = async () => {
    if (!onDeleteBlocks || selectedBlockIds.length === 0) return
    await onDeleteBlocks(selectedBlockIds)
    setSelectedBlockIds([])
  }

  const handleRefresh = async () => {
    await onRefresh?.()
  }

  const totalFieldCount = blockFields?.filter((field) => !field.hidden).length ?? 0

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="w-8 px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={selectedBlockIds.length > 0 && selectedBlockIds.length === filteredRows.length}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedBlockIds(filteredRows.map((row) => row.id))
                    } else {
                      setSelectedBlockIds([])
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
              <th scope="col" className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
              <th scope="col" className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Area</th>
              <th scope="col" className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Variety</th>
              <th scope="col" className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Updated</th>
              {onEditBlock && (
                <th scope="col" className="px-3 py-3" />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={onEditBlock ? 6 : 5} className="px-4 py-6 text-center text-sm text-gray-500">
                  Loading blocks…
                </td>
              </tr>
            )}
            {!loading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={onEditBlock ? 6 : 5} className="px-4 py-6 text-center text-sm text-gray-500">
                  No blocks match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              filteredRows.map((row) => {
                const isSelected = selectedBlockIds.includes(row.id)
                const isActive = selectedBlockId === row.id
                return (
                  <tr
                    key={row.id}
                    className={clsx(
                      'cursor-pointer hover:bg-gray-50',
                      {
                        'bg-primary-50/80 border-l-2 border-primary-400': isActive,
                      }
                    )}
                    onClick={() => onOpenBlockDetails?.(row.id)}
                  >
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          event.stopPropagation()
                          toggleSelection(row.id)
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-2 py-3 text-sm font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{row.name}</span>
                        {row.feature?.properties?.blockId && (
                          <span className="text-xs text-gray-400">ID: {(row.feature.properties as any).blockId}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-700">{formatArea(row.area, measurementSystem)}</td>
                    <td className="px-2 py-3 text-sm text-gray-700">{row.variety || '—'}</td>
                    <td className="px-2 py-3 text-sm text-gray-700">{formatUpdatedAt(row.updatedAt)}</td>
                    {onEditBlock && (
                      <td className="px-3 py-3 text-right text-sm">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onEditBlock?.(row.id)
                          }}
                          className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
