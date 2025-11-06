"use client"

import { useEffect, useMemo } from 'react'
import type mapboxgl from 'mapbox-gl'
import bbox from '@turf/bbox'
import { PhotographIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { Button } from '@/components/ui/button'
import { useMapContext } from '@/context/MapContext'
import { Block, BlockFieldDefinition } from '@/types/block'
import { formatArea } from '@/lib/utils'

const DETAILS_HIGHLIGHT_SOURCE_ID = 'block-details-highlight-source'
const DETAILS_HIGHLIGHT_LAYER_ID = 'block-details-highlight-fill'
const DETAILS_HIGHLIGHT_OUTLINE_LAYER_ID = 'block-details-highlight-outline'

export interface BlockDetailsDrawerProps {
  isOpen: boolean
  block: Block | null
  blockFeature?: GeoJSON.Feature | null
  blockFields?: BlockFieldDefinition[]
  measurementSystem?: 'Metric' | 'Imperial'
  onClose: () => void
  onEdit?: (block: Block) => void
  onShowRevisions?: (block: Block) => void
}

export default function BlockDetailsDrawer({
  isOpen,
  block,
  blockFeature,
  blockFields = [],
  measurementSystem = 'Metric',
  onClose,
  onEdit,
  onShowRevisions,
}: BlockDetailsDrawerProps) {
  const { map } = useMapContext()

  const featureCollection = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (blockFeature?.geometry) {
      return {
        type: 'FeatureCollection',
        features: [blockFeature],
      }
    }
    if (block?.geometry) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: block.geometry as GeoJSON.Geometry,
            properties: {},
          },
        ],
      }
    }
    return null
  }, [block, blockFeature])

  useEffect(() => {
    if (!map || !isOpen || !featureCollection) return

    if (map.getSource(DETAILS_HIGHLIGHT_SOURCE_ID)) {
      ;(map.getSource(DETAILS_HIGHLIGHT_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(featureCollection)
    } else {
      map.addSource(DETAILS_HIGHLIGHT_SOURCE_ID, {
        type: 'geojson',
        data: featureCollection,
      })
    }

    if (!map.getLayer(DETAILS_HIGHLIGHT_LAYER_ID)) {
      map.addLayer({
        id: DETAILS_HIGHLIGHT_LAYER_ID,
        type: 'fill',
        source: DETAILS_HIGHLIGHT_SOURCE_ID,
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.45,
        },
      })
    }

    if (!map.getLayer(DETAILS_HIGHLIGHT_OUTLINE_LAYER_ID)) {
      map.addLayer({
        id: DETAILS_HIGHLIGHT_OUTLINE_LAYER_ID,
        type: 'line',
        source: DETAILS_HIGHLIGHT_SOURCE_ID,
        paint: {
          'line-width': 2,
          'line-color': '#ffffff',
        },
      })
    }

    try {
      const bounds = bbox(featureCollection) as mapboxgl.LngLatBoundsLike
      map.fitBounds(bounds, { padding: 60, duration: 800 })
    } catch (error) {
      console.warn('Could not fit bounds for block feature:', error)
    }

    return () => {
      if (map) {
        if (map.getLayer(DETAILS_HIGHLIGHT_LAYER_ID)) map.removeLayer(DETAILS_HIGHLIGHT_LAYER_ID)
        if (map.getLayer(DETAILS_HIGHLIGHT_OUTLINE_LAYER_ID)) map.removeLayer(DETAILS_HIGHLIGHT_OUTLINE_LAYER_ID)
        if (map.getSource(DETAILS_HIGHLIGHT_SOURCE_ID)) map.removeSource(DETAILS_HIGHLIGHT_SOURCE_ID)
      }
    }
  }, [featureCollection, isOpen, map])

  const groupedFields = useMemo(() => {
    if (!blockFields.length) return []
    const groups = new Map<string, BlockFieldDefinition[]>()
    blockFields.forEach((field) => {
      if (field.hidden || field.type === 'Image') return
      const group = field.group || 'Details'
      if (!groups.has(group)) {
        groups.set(group, [])
      }
      groups.get(group)!.push(field)
    })
    return Array.from(groups.entries())
  }, [blockFields])

  const imageFields = useMemo(() => {
    return blockFields.filter((field) => field.type === 'Image')
  }, [blockFields])

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={block ? block.name : 'Block Details'}
      showBackdrop
    >
      {!block ? (
        <p className="text-sm text-gray-500">Select a block to view its details.</p>
      ) : (
        <div className="space-y-6 pb-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-600">Block ID</p>
              <p className="text-sm font-medium text-gray-900">{block.id}</p>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button size="sm" variant="outline" onClick={() => onEdit(block)}>
                  Edit Block
                </Button>
              )}
              {onShowRevisions && (
                <Button size="sm" onClick={() => onShowRevisions(block)}>
                  Revisions
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Area
                </dt>
                <dd className="text-sm text-gray-900">
                  {formatArea(block.area || 0, measurementSystem)}
                </dd>
              </div>
              {block.description && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Description
                  </dt>
                  <dd className="text-sm text-gray-700">{block.description}</dd>
                </div>
              )}
              {block.variety && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Variety
                  </dt>
                  <dd className="text-sm text-gray-900">{block.variety}</dd>
                </div>
              )}
              {block.plantingYear && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Planting Year
                  </dt>
                  <dd className="text-sm text-gray-900">{block.plantingYear}</dd>
                </div>
              )}
              {block.rowSpacing && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Row Spacing
                  </dt>
                  <dd className="text-sm text-gray-900">{block.rowSpacing} m</dd>
                </div>
              )}
              {block.vineSpacing && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Vine Spacing
                  </dt>
                  <dd className="text-sm text-gray-900">{block.vineSpacing} m</dd>
                </div>
              )}
            </dl>
          </div>

          {groupedFields.length > 0 && (
            <div className="space-y-5">
              {groupedFields.map(([group, fields]) => (
                <div key={group}>
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">{group}</h4>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                    {fields.map((field) => (
                      <div key={field.machineName}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {field.label}
                        </dt>
                        <dd className="text-sm text-gray-900">{renderFieldValue(block, field)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}

          {imageFields.length > 0 && (
            <div className="space-y-6">
              {imageFields.map((field) => {
                const images = getImageList(block, field)
                if (!images.length) return null
                return (
                  <div key={field.machineName}>
                    <h4 className="mb-2 text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <PhotographIcon className="h-4 w-4 text-gray-500" />
                      {field.label}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {images.map((image) => (
                        <figure
                          key={image.url}
                          className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                        >
                          <img src={image.url} alt={image.caption || field.label} className="h-32 w-full object-cover" />
                          {image.caption && (
                            <figcaption className="px-2 py-1 text-xs text-gray-500">
                              {image.caption}
                            </figcaption>
                          )}
                        </figure>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="space-y-1 text-xs text-gray-500">
            {block.updatedAt && (
              <p>
                Updated {new Date(block.updatedAt).toLocaleString()}
                {block.updatedByName ? ` by ${block.updatedByName}` : ''}
              </p>
            )}
            {block.createdAt && <p>Created {new Date(block.createdAt).toLocaleString()}</p>}
            {block.revisionMessage && (
              <p className="text-gray-600">Last revision: {block.revisionMessage}</p>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}

function renderFieldValue(block: Block, field: BlockFieldDefinition): string {
  const key = field.machineName || (field as unknown as { machine_name?: string }).machine_name || field.label
  const value = (block as Record<string, unknown>)[key]
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  if (field.type === 'Date and Time') {
    if (value instanceof Date) {
      return value.toLocaleString()
    }
    if (value && typeof value === 'object' && 'toDate' in (value as any)) {
      try {
        const date = (value as any).toDate()
        return date instanceof Date ? date.toLocaleString() : String(value)
      } catch (error) {
        return String(value)
      }
    }
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}

interface ImageItem {
  url: string
  caption?: string
}

function getImageList(block: Block, field: BlockFieldDefinition): ImageItem[] {
  const key = field.machineName || (field as unknown as { machine_name?: string }).machine_name || field.label
  const value = (block as Record<string, unknown>)[key]
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const url = (record.url as string) || (record.large as string) || (record.path as string)
      if (!url) return null
      return {
        url,
        caption: typeof record.caption === 'string' ? record.caption : undefined,
      }
    })
    .filter((item): item is ImageItem => Boolean(item))
}

