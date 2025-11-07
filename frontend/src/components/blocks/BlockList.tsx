"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { CheckCircleIcon, MapIcon, TrashIcon } from '@heroicons/react/24/outline'

import BulkUpdateModal from '@/components/blocks/BulkUpdateModal'
import Spinner from '@/components/ui/Spinner'
import { Button } from '@/components/ui/button'
import { useMapContext } from '@/context/MapContext'
import { Block, BlockFieldDefinition } from '@/types/block'
import { formatArea } from '@/lib/utils'

interface SelectedBlock {
  id: string
  feature: GeoJSON.Feature
}

export interface BlockListProps {
  blocks: GeoJSON.Feature[]
  blockEntities: Block[]
  measurementSystem?: 'Metric' | 'Imperial'
  blockFields?: BlockFieldDefinition[]
  loading?: boolean
  onRefresh?: () => Promise<void> | void
  onCreateBlocks?: () => void
  onOpenBlockDetails?: (blockId: string) => void
  onEditBlock?: (blockId: string) => void
  onDeleteBlocks?: (blockIds: string[]) => Promise<void> | void
  onBulkUpdate?: (
    field: BlockFieldDefinition,
    value: unknown,
    blockIds: string[]
  ) => Promise<void> | void
  onRequestSelectOnMap?: () => void
}

const HIGHLIGHT_SOURCE_ID = 'select-blocks-highlight'
const HIGHLIGHT_LAYER_ID = 'select-blocks-highlight-fill'
const HIGHLIGHT_OUTLINE_LAYER_ID = 'select-blocks-highlight-outline'
const MAP_SELECT_LAYER_ID = 'select-blocks-layer'
const MAP_SELECT_OUTLINE_LAYER_ID = 'select-blocks-layer-outline'

export default function BlockList({
  blocks,
  blockEntities,
  measurementSystem = 'Metric',
  blockFields = [],
  loading,
  onCreateBlocks,
  onOpenBlockDetails,
  onEditBlock,
  onDeleteBlocks,
  onBulkUpdate,
  onRequestSelectOnMap,
}: BlockListProps) {
  const { map } = useMapContext()

  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([])
  const [mapSelectMode, setMapSelectMode] = useState(false)
  const [showBulkUpdate, setShowBulkUpdate] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)

  const featureLookup = useMemo(() => {
    const map = new Map<string, GeoJSON.Feature>()
    blocks.forEach((feature) => {
      const id = getFeatureBlockId(feature)
      if (id) {
        map.set(id, feature)
      }
    })
    return map
  }, [blocks])

  const derivedFields = useMemo(() => {
    if (blockFields.length > 0) {
      return blockFields
    }
    if (!blocks.length) return []

    const first = blocks[0]
    const props = (first.properties as Record<string, unknown>) || {}
    return Object.keys(props)
      .filter((key) => !['id', 'name', 'description', 'area', 'variety', 'plantingYear', 'rowSpacing', 'vineSpacing'].includes(key))
      .map<BlockFieldDefinition>((key) => ({
        label: key,
        machineName: key,
        type: typeof props[key] === 'number' ? 'Number' : 'Text',
      }))
  }, [blockFields, blocks])

  const selectedIds = useMemo(() => selectedBlocks.map((item) => item.id), [selectedBlocks])

  const highlightGeoJson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: selectedBlocks.map((item) => item.feature),
  }), [selectedBlocks])

  const updateHighlightLayer = useCallback(() => {
    if (!map) return

    if (!selectedBlocks.length) {
      if (map.getLayer(HIGHLIGHT_LAYER_ID)) map.removeLayer(HIGHLIGHT_LAYER_ID)
      if (map.getLayer(HIGHLIGHT_OUTLINE_LAYER_ID)) map.removeLayer(HIGHLIGHT_OUTLINE_LAYER_ID)
      if (map.getSource(HIGHLIGHT_SOURCE_ID)) map.removeSource(HIGHLIGHT_SOURCE_ID)
      return
    }

    if (map.getSource(HIGHLIGHT_SOURCE_ID)) {
      ;(map.getSource(HIGHLIGHT_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(highlightGeoJson)
    } else {
      map.addSource(HIGHLIGHT_SOURCE_ID, {
        type: 'geojson',
        data: highlightGeoJson,
      })
    }

    if (!map.getLayer(HIGHLIGHT_LAYER_ID)) {
      map.addLayer({
        id: HIGHLIGHT_LAYER_ID,
        type: 'fill',
        source: HIGHLIGHT_SOURCE_ID,
        paint: {
          'fill-color': '#ffc107',
          'fill-opacity': 0.55,
        },
      })
    }

    if (!map.getLayer(HIGHLIGHT_OUTLINE_LAYER_ID)) {
      map.addLayer({
        id: HIGHLIGHT_OUTLINE_LAYER_ID,
        type: 'line',
        source: HIGHLIGHT_SOURCE_ID,
        paint: {
          'line-color': '#ffffff',
          'line-width': 2,
        },
      })
    }
  }, [highlightGeoJson, map, selectedBlocks.length])

  useEffect(() => {
    updateHighlightLayer()
    return () => {
      if (map) {
        if (map.getLayer(HIGHLIGHT_LAYER_ID)) map.removeLayer(HIGHLIGHT_LAYER_ID)
        if (map.getLayer(HIGHLIGHT_OUTLINE_LAYER_ID)) map.removeLayer(HIGHLIGHT_OUTLINE_LAYER_ID)
        if (map.getSource(HIGHLIGHT_SOURCE_ID)) map.removeSource(HIGHLIGHT_SOURCE_ID)
      }
    }
  }, [map, updateHighlightLayer])

  useEffect(() => {
    if (!map) return

    const handleMapClick = (event: mapboxgl.MapLayerMouseEvent) => {
      const features = event.features as GeoJSON.Feature[] | undefined
      if (!features || !features.length) return
      const feature = features[0]
      const blockId = getFeatureBlockId(feature)
      if (!blockId) return

      setSelectedBlocks((prev) => {
        const exists = prev.find((item) => item.id === blockId)
        if (exists) {
          return prev.filter((item) => item.id !== blockId)
        }
        return [...prev, { id: blockId, feature }]
      })
    }

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    if (mapSelectMode) {
      const sourceData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: blocks,
      }

      if (map.getSource(MAP_SELECT_LAYER_ID)) {
        ;(map.getSource(MAP_SELECT_LAYER_ID) as mapboxgl.GeoJSONSource).setData(sourceData)
      } else {
        map.addSource(MAP_SELECT_LAYER_ID, {
          type: 'geojson',
          data: sourceData,
        })
      }

      if (!map.getLayer(MAP_SELECT_LAYER_ID)) {
        map.addLayer({
          id: MAP_SELECT_LAYER_ID,
          type: 'fill',
          source: MAP_SELECT_LAYER_ID,
          paint: {
            'fill-color': '#2563eb',
            'fill-opacity': 0.2,
          },
        })
      }

      if (!map.getLayer(MAP_SELECT_OUTLINE_LAYER_ID)) {
        map.addLayer({
          id: MAP_SELECT_OUTLINE_LAYER_ID,
          type: 'line',
          source: MAP_SELECT_LAYER_ID,
          paint: {
            'line-width': 1.5,
            'line-color': '#ffffff',
          },
        })
      }

      map.on('mouseenter', MAP_SELECT_LAYER_ID, handleMouseEnter)
      map.on('mouseleave', MAP_SELECT_LAYER_ID, handleMouseLeave)

      map.on('click', MAP_SELECT_LAYER_ID, handleMapClick)
    }

    return () => {
      if (mapSelectMode) {
        map.off('click', MAP_SELECT_LAYER_ID, handleMapClick)
        map.off('mouseenter', MAP_SELECT_LAYER_ID, handleMouseEnter)
        map.off('mouseleave', MAP_SELECT_LAYER_ID, handleMouseLeave)
        if (map.getLayer(MAP_SELECT_LAYER_ID)) map.removeLayer(MAP_SELECT_LAYER_ID)
        if (map.getLayer(MAP_SELECT_OUTLINE_LAYER_ID)) map.removeLayer(MAP_SELECT_OUTLINE_LAYER_ID)
        if (map.getSource(MAP_SELECT_LAYER_ID)) map.removeSource(MAP_SELECT_LAYER_ID)
        map.getCanvas().style.cursor = ''
      }
    }
  }, [blocks, map, mapSelectMode])

  const toggleSelection = (blockId: string) => {
    const feature = featureLookup.get(blockId)
    if (!feature) return

    setSelectedBlocks((prev) => {
      const exists = prev.find((item) => item.id === blockId)
      if (exists) {
        return prev.filter((item) => item.id !== blockId)
      }
      return [...prev, { id: blockId, feature }]
    })
  }

  const handleDeleteSelected = async () => {
    if (!onDeleteBlocks || !selectedIds.length) return
    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected block${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`
    )
    if (!confirmed) return

    try {
      setDeleting(true)
      await onDeleteBlocks(selectedIds)
      setSelectedBlocks([])
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkUpdate = async (field: BlockFieldDefinition, value: unknown) => {
    if (!onBulkUpdate) return
    try {
      setBulkUpdating(true)
      await onBulkUpdate(field, value, selectedIds)
      setShowBulkUpdate(false)
    } finally {
      setBulkUpdating(false)
    }
  }

  const totalArea = useMemo(() => {
    return blockEntities.reduce((sum, block) => sum + (block.area || 0), 0)
  }, [blockEntities])

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Blocks ({blockEntities.length})</h3>
          <p className="text-sm text-gray-600">
            Total area: {formatArea(totalArea, measurementSystem)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mapSelectMode ? 'default' : 'secondary'}
            onClick={() => {
              const next = !mapSelectMode
              setMapSelectMode(next)
              if (next) {
                onRequestSelectOnMap?.()
              }
            }}
            className="flex items-center gap-2"
          >
            <MapIcon className="h-4 w-4" />
            {mapSelectMode ? 'Stop Map Selection' : 'Select on Map'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowBulkUpdate(true)}
            disabled={!selectedIds.length || !onBulkUpdate}
          >
            Bulk Update ({selectedIds.length})
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={!selectedIds.length || deleting || !onDeleteBlocks}
            className="flex items-center gap-2"
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </Button>

          {onCreateBlocks && (
            <Button type="button" onClick={onCreateBlocks}>
              Create Blocks
            </Button>
          )}
        </div>
      </div>

      {blockEntities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          No blocks yet. Draw a polygon on the map or import a GIS file to create blocks for this farm.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Area
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Variety
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Planted
                </th>
                {derivedFields.map((field) => (
                  <th
                    key={field.machineName}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {field.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {blocks.map((feature) => {
                const blockId = getFeatureBlockId(feature)
                if (!blockId) return null
                const blockEntity = blockEntities.find((block) => block.id === blockId)
                const isSelected = selectedIds.includes(blockId)
                const props = (feature.properties || {}) as Record<string, unknown>
                const blockName =
                  typeof props.name === 'string' && props.name.trim().length > 0
                    ? props.name
                    : 'Untitled Block'
                const areaValue =
                  typeof props.area === 'number'
                    ? props.area
                    : typeof props.area === 'string'
                      ? Number(props.area) || 0
                      : 0
                const blockVariety =
                  typeof props.variety === 'string' && props.variety.trim().length > 0
                    ? props.variety
                    : '—'
                const plantingYear =
                  typeof props.plantingYear === 'number'
                    ? String(props.plantingYear)
                    : typeof props.plantingYear === 'string' && props.plantingYear.trim().length > 0
                      ? props.plantingYear
                      : '—'

                return (
                  <tr key={blockId} className={isSelected ? 'bg-blue-50' : undefined}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      <button
                        type="button"
                        onClick={() => toggleSelection(blockId)}
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500'
                        }`}
                        title={isSelected ? 'Deselect block' : 'Select block'}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      <button
                        type="button"
                        onClick={() => onOpenBlockDetails?.(blockId)}
                        className="text-left text-blue-600 underline-offset-2 hover:underline"
                      >
                        {blockName}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {formatArea(areaValue, measurementSystem)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">{blockVariety}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{plantingYear}</td>
                    {derivedFields.map((field) => (
                      <td key={`${blockId}-${field.machineName}`} className="px-3 py-2 text-sm text-gray-700">
                        {formatFieldValue(props[field.machineName as keyof typeof props])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        {onEditBlock && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onEditBlock(blockId)}
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSelection(blockId)}
                        >
                          {isSelected ? 'Deselect' : 'Select'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {onBulkUpdate && (
        <BulkUpdateModal
          open={showBulkUpdate}
          fields={blockFields.length ? blockFields : derivedFields}
          onClose={() => setShowBulkUpdate(false)}
          onSubmit={handleBulkUpdate}
          busy={bulkUpdating}
        />
      )}
    </div>
  )
}

function getFeatureBlockId(feature: GeoJSON.Feature | undefined | null): string | null {
  if (!feature) return null
  const props = (feature.properties || {}) as Record<string, unknown>
  const id = feature.id ?? props.id ?? props.blockId
  if (id === undefined || id === null) return null
  return String(id)
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (value instanceof Date) {
    return value.toLocaleString()
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : '—'
  }
  return String(value)
}


