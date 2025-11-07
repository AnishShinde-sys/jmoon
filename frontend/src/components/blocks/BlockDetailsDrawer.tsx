"use client"

import { useEffect, useMemo, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import bbox from '@turf/bbox'
import { getDownloadURL, getStorage, ref, type Storage } from 'firebase/storage'
import { PhotoIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { Button } from '@/components/ui/button'
import { useMapContext } from '@/context/MapContext'
import { Block, BlockFieldDefinition } from '@/types/block'
import { formatArea } from '@/lib/utils'
import { app } from '@/lib/firebase'

interface ImageItem {
  url: string
  caption?: string
}

let cachedStorage: Storage | null = null

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

  const [imageMap, setImageMap] = useState<Record<string, ImageItem[]>>({})
  const [loadingImages, setLoadingImages] = useState(false)

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

  const imageFields = useMemo(() => {
    return blockFields.filter((field) => field.type === 'Image')
  }, [blockFields])

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

  useEffect(() => {
    let isMounted = true

    const loadImages = async () => {
      if (!isOpen || !block || !imageFields.length) {
        setImageMap({})
        return
      }

      setLoadingImages(true)
      const storage = ensureStorage()
      const blockRecord = block as unknown as Record<string, unknown>
      const next: Record<string, ImageItem[]> = {}

      for (const field of imageFields) {
        const key = getFieldKey(field)
        const rawValue = blockRecord[key]
        if (!Array.isArray(rawValue)) continue

        const images: ImageItem[] = []
        for (const item of rawValue) {
          try {
            const resolved = await resolveImageItem(item, storage)
            if (resolved) {
              images.push(resolved)
            }
          } catch (error) {
            console.warn('Failed to resolve block image item:', error)
          }
        }

        if (images.length) {
          next[key] = images
        }
      }

      if (isMounted) {
        setImageMap(next)
        setLoadingImages(false)
      }
    }

    loadImages()

    return () => {
      isMounted = false
    }
  }, [block, imageFields, isOpen])

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
              {loadingImages && (
                <p className="text-xs text-gray-500">Loading images…</p>
              )}
              {imageFields.map((field) => {
                const key = getFieldKey(field)
                const images = imageMap[key]
                if (!images || !images.length) return null
                return (
                  <div key={key}>
                    <h4 className="mb-2 text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <PhotoIcon className="h-4 w-4 text-gray-500" />
                      {field.label}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {images.map((image) => (
                        <figure
                          key={image.url}
                          className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                        >
                          <img
                            src={image.url}
                            alt={image.caption || field.label}
                            className="h-32 w-full object-cover"
                          />
                          <figcaption className="px-2 py-1 text-xs text-gray-500">
                            <a
                              href={image.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700"
                            >
                              View full image ↗
                            </a>
                            {image.caption && (
                              <span className="ml-2 text-gray-400">{image.caption}</span>
                            )}
                          </figcaption>
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
  const key = getFieldKey(field)
  const blockRecord = block as unknown as Record<string, unknown>
  const value = blockRecord[key]
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

function ensureStorage(): Storage | null {
  if (cachedStorage) return cachedStorage
  try {
    cachedStorage = getStorage(app)
    return cachedStorage
  } catch (error) {
    console.warn('Firebase storage not configured for block images:', error)
    return null
  }
}

async function resolveImageItem(value: any, storage: Storage | null): Promise<ImageItem | null> {
  if (!value) return null

  const build = (url: string | null | undefined, caption?: string): ImageItem | null => {
    if (!url) return null
    return { url, caption }
  }

  if (typeof value === 'string') {
    if (value.startsWith('http')) {
      return build(value)
    }
    if (storage) {
      try {
        const downloadUrl = await getDownloadURL(ref(storage, value))
        return build(downloadUrl)
      } catch (error) {
        console.warn('Failed to load image from storage path:', error)
      }
    }
    return null
  }

  if (typeof value === 'object') {
    const record = value as Record<string, any>
    if (typeof record.url === 'string' && record.url) {
      return build(record.url, typeof record.caption === 'string' ? record.caption : undefined)
    }

    const candidates = ['large', 'path']
    for (const key of candidates) {
      const candidate = record[key]
      if (typeof candidate === 'string' && candidate) {
        if (candidate.startsWith('http')) {
          return build(candidate, typeof record.caption === 'string' ? record.caption : undefined)
        }
        if (storage) {
          try {
            const downloadUrl = await getDownloadURL(ref(storage, candidate))
            return build(downloadUrl, typeof record.caption === 'string' ? record.caption : undefined)
          } catch (error) {
            console.warn('Failed to fetch image from storage candidate:', error)
          }
        }
      }
    }
  }

  return null
}

function getFieldKey(field: BlockFieldDefinition): string {
  return field.machineName || (field as unknown as { machine_name?: string }).machine_name || field.label
}


