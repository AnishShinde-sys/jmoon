"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import bbox from '@turf/bbox'
import shp from 'shpjs'

import Drawer from '@/components/ui/Drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMapContext } from '@/context/MapContext'
import { useUI } from '@/context/UIContext'
import { Block, BlockField, BlockFieldDefinition, CreateBlockInput, UpdateBlockInput } from '@/types/block'

type DrawerMode = 'create' | 'edit'

interface BulkHeaderDefinition {
  name: string
  type: 'Text' | 'Number'
  nameField?: boolean
}

interface CreateBlockDrawerProps {
  isOpen: boolean
  mode: DrawerMode
  block?: Block | null
  blockGeometry?: GeoJSON.Geometry | null
  blockFields?: BlockFieldDefinition[]
  onClose: () => void
  onCreate: (input: CreateBlockInput) => Promise<any>
  onUpdate: (blockId: string, input: UpdateBlockInput & { revisionMessage?: string }) => Promise<any>
  onDelete: (blockId: string) => Promise<void>
  onRefetch?: () => Promise<void>
}

interface FormValues {
  name: string
  description: string
  variety: string
  plantingYear: string
  rowSpacing: string
  vineSpacing: string
}

interface NormalizedFieldValue {
  storedValue: any
  customValue: string | number | boolean
  dataType: 'string' | 'number' | 'boolean' | 'date'
}

const DRAW_SOURCE_ID = 'create-block-draft'

export default function CreateBlockDrawer({
  isOpen,
  mode,
  block,
  blockGeometry,
  blockFields = [],
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onRefetch,
}: CreateBlockDrawerProps) {
  const { map, draw } = useMapContext()
  const { showAlert } = useUI()

  const [form, setForm] = useState<FormValues>({
    name: '',
    description: '',
    variety: '',
    plantingYear: '',
    rowSpacing: '',
    vineSpacing: '',
  })
  const [revisionMessage, setRevisionMessage] = useState('')
  const [draftGeometry, setDraftGeometry] = useState<GeoJSON.Geometry | null>(null)
  const [loading, setLoading] = useState(false)
  const [bulkHeaders, setBulkHeaders] = useState<BulkHeaderDefinition[]>([])
  const [nameHeader, setNameHeader] = useState<string | null>(null)
  const [loadingFromFile, setLoadingFromFile] = useState(false)
  const [importedFeatures, setImportedFeatures] = useState<GeoJSON.FeatureCollection | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const getFieldKey = useCallback((field: BlockFieldDefinition) => {
    return field.machineName || (field as unknown as { machine_name?: string }).machine_name || field.label
  }, [])

  const formatDateInputValue = useCallback((value: unknown, includeTime: boolean) => {
    if (!value) return ''
    let date: Date | null = null
    if (value instanceof Date) {
      date = value
    } else if (value && typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
      try {
        const converted = (value as any).toDate()
        if (converted instanceof Date) {
          date = converted
        }
      } catch (error) {
        date = null
      }
    } else if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        date = parsed
      }
    }

    if (!date) return ''

    const tzOffset = date.getTimezoneOffset() * 60000
    const localISO = new Date(date.getTime() - tzOffset).toISOString()
    return includeTime ? localISO.slice(0, 16) : localISO.slice(0, 10)
  }, [])

  const importFieldDefinitions = useMemo<BlockFieldDefinition[]>(
    () =>
      bulkHeaders.map((header) => ({
        label: header.name,
        machineName: header.name,
        type: header.type,
      })),
    [bulkHeaders]
  )

  const combinedFieldDefinitions = useMemo(() => {
    const merged = new Map<string, BlockFieldDefinition>()
    blockFields.forEach((field) => {
      const key = getFieldKey(field)
      merged.set(key, field)
    })
    importFieldDefinitions.forEach((field) => {
      const key = getFieldKey(field)
      if (!merged.has(key)) {
        merged.set(key, field)
      }
    })
    return Array.from(merged.values())
  }, [blockFields, getFieldKey, importFieldDefinitions]
  )

  const resetForm = useCallback(() => {
    setForm({
      name: '',
      description: '',
      variety: '',
      plantingYear: '',
      rowSpacing: '',
      vineSpacing: '',
    })
    setRevisionMessage('')
    setDraftGeometry(null)
    setBulkHeaders([])
    setNameHeader(null)
    setLoadingFromFile(false)
    setImportedFeatures(null)
    setFieldValues({})
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const clearDraftFeatures = useCallback(() => {
    if (!draw) return
    try {
      const all = draw.getAll()
      all?.features?.forEach((feature: any) => {
        if (!feature?.properties?.__persisted && feature?.id) {
          draw.delete(feature.id)
        }
      })
    } catch (error) {
      console.warn('Failed to clear draft features:', error)
    }
  }, [draw])

  const fillFormFromBlock = useCallback(
    (blockData: Block) => {
      setForm({
        name: blockData.name || '',
        description: blockData.description || '',
        variety: blockData.variety || '',
        plantingYear: blockData.plantingYear ? String(blockData.plantingYear) : '',
        rowSpacing: blockData.rowSpacing != null ? String(blockData.rowSpacing) : '',
        vineSpacing: blockData.vineSpacing != null ? String(blockData.vineSpacing) : '',
      })
      setRevisionMessage(blockData.revisionMessage || '')
      if (blockGeometry) {
        setDraftGeometry(blockGeometry)
      }

      const nextFieldValues: Record<string, any> = {}
      const blockRecord = blockData as unknown as Record<string, unknown>
      blockFields.forEach((field) => {
        const key = getFieldKey(field)
        const rawValue = blockRecord[key]
        if (field.type === 'Date and Time') {
          const formatted = formatDateInputValue(rawValue, Boolean(field.includeTime))
          if (formatted) {
            nextFieldValues[key] = formatted
          }
        } else if (field.type === 'Boolean') {
          if (typeof rawValue === 'boolean') {
            nextFieldValues[key] = rawValue
          } else if (rawValue !== undefined && rawValue !== null) {
            nextFieldValues[key] = Boolean(rawValue)
          }
        } else if (rawValue !== undefined && rawValue !== null) {
          nextFieldValues[key] = rawValue
        }
      })
      setFieldValues(nextFieldValues)
    },
    [blockFields, blockGeometry, formatDateInputValue, getFieldKey]
  )

  useEffect(() => {
    if (!isOpen) {
      resetForm()
      clearDraftSource()
      return
    }

    if (mode === 'edit' && block) {
      fillFormFromBlock(block)
    } else {
      resetForm()
    }
  }, [block, fillFormFromBlock, isOpen, mode, resetForm])

  const clearDraftSource = useCallback(() => {
    if (!map) return
    if (map.getLayer(DRAW_SOURCE_ID)) map.removeLayer(DRAW_SOURCE_ID)
    if (map.getLayer(`${DRAW_SOURCE_ID}-outline`)) map.removeLayer(`${DRAW_SOURCE_ID}-outline`)
    if (map.getSource(DRAW_SOURCE_ID)) map.removeSource(DRAW_SOURCE_ID)
  }, [map])

  const syncDraftFromDraw = useCallback(() => {
    if (!draw) return
    let geometry: GeoJSON.Geometry | null = null
    if (mode === 'edit' && block?.id) {
      try {
        const feature = draw.get(block.id)
        if (feature?.geometry) {
          geometry = feature.geometry as GeoJSON.Geometry
        }
      } catch (error) {
        console.warn('Unable to read geometry from draw:', error)
      }
    }

    if (!geometry) {
      try {
        const all = draw?.getAll()
        const features = all?.features ?? []
        if (features.length) {
          geometry = features[0].geometry ?? null
        }
      } catch (error) {
        console.warn('Failed to read draft geometry:', error)
      }
    }

    if (geometry) {
      setDraftGeometry(JSON.parse(JSON.stringify(geometry)))
    }
  }, [block?.id, draw, mode])

  useEffect(() => {
    if (!map || !draw || !isOpen) return

    const handleDrawEvent = () => {
      syncDraftFromDraw()
    }

    const events: Array<'draw.create' | 'draw.update' | 'draw.delete' | 'draw.selectionchange'> = [
      'draw.create',
      'draw.update',
      'draw.delete',
      'draw.selectionchange',
    ]

    events.forEach((eventName) => {
      map.on(eventName as any, handleDrawEvent as any)
    })

    syncDraftFromDraw()

    return () => {
      events.forEach((eventName) => {
        map.off(eventName as any, handleDrawEvent as any)
      })
    }
  }, [draw, isOpen, map, syncDraftFromDraw])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    setLoadingFromFile(true)

    try {
      if (extension === 'geojson' || extension === 'json') {
        const text = await file.text()
        const geojson = JSON.parse(text)
        if (geojson?.type === 'FeatureCollection') {
          processImportedGeoJson(geojson)
        } else {
          throw new Error('Unsupported GeoJSON format')
        }
      } else if (extension === 'zip') {
        const arrayBuffer = await file.arrayBuffer()
        const geojson = await shp(arrayBuffer)
        processImportedGeoJson(geojson)
      } else {
        showAlert('Unsupported file type. Upload GeoJSON or a zipped Shapefile.', 'error')
      }
    } catch (error) {
      console.error('Failed to import GIS file:', error)
      showAlert('Unable to import GIS file. Confirm it is valid GeoJSON or a zipped Shapefile.', 'error')
    } finally {
      setLoadingFromFile(false)
    }
  }

  const processImportedGeoJson = (geojson: any) => {
    try {
      const cleaned = normalizeGeoJson(geojson)
      if (!cleaned.features || !cleaned.features.length) {
        showAlert('No polygon features found in file.', 'warning')
        return
      }

      setDraftGeometry(cleaned.features.length === 1 ? cleaned.features[0].geometry : null)
      setImportedFeatures(cleaned)

      const headers = deriveHeadersFromFeature(cleaned.features[0])
      setBulkHeaders(headers)
      setNameHeader(headers.find((header) => header.nameField)?.name ?? null)

      if (map) {
        if (map.getSource(DRAW_SOURCE_ID)) {
          ;(map.getSource(DRAW_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(cleaned)
        } else {
          map.addSource(DRAW_SOURCE_ID, {
            type: 'geojson',
            data: cleaned,
          })
        }

        if (!map.getLayer(DRAW_SOURCE_ID)) {
          map.addLayer({
            id: DRAW_SOURCE_ID,
            type: 'fill',
            source: DRAW_SOURCE_ID,
            paint: {
              'fill-color': '#8b5cf6',
              'fill-opacity': 0.35,
            },
          })
        }

        if (!map.getLayer(`${DRAW_SOURCE_ID}-outline`)) {
          map.addLayer({
            id: `${DRAW_SOURCE_ID}-outline`,
            type: 'line',
            source: DRAW_SOURCE_ID,
            paint: {
              'line-color': '#ffffff',
              'line-width': 1.5,
            },
          })
        }
        const bounds = (bbox(cleaned) as mapboxgl.LngLatBoundsLike) || undefined
        map.fitBounds(bounds, { padding: 60, duration: 800 })
      }

      showAlert(
        cleaned.features.length > 1
          ? `Imported ${cleaned.features.length} polygons. Submitting will create multiple blocks.`
          : 'Imported polygon assigned to current block.',
        'success'
      )
    } catch (error) {
      console.error('Error processing GeoJSON:', error)
      showAlert('There was an issue processing the uploaded GIS file.', 'error')
    }
  }

  const normalizeFieldValue = useCallback(
    (field: BlockFieldDefinition, rawValue: unknown): NormalizedFieldValue | null => {
      if (field.hidden || field.type === 'Image') {
        return null
      }

      if (rawValue === undefined || rawValue === null || rawValue === '') {
        return null
      }

      const coerceNumber = (val: unknown) => {
        if (typeof val === 'number') return val
        if (typeof val === 'string' && val.trim().length) {
          const parsed = Number(val)
          return Number.isNaN(parsed) ? null : parsed
        }
        return null
      }

      switch (field.type) {
        case 'Number':
        case 'CV Number': {
          const numberValue = coerceNumber(rawValue)
          if (numberValue === null) return null
          return {
            storedValue: numberValue,
            customValue: numberValue,
            dataType: 'number',
          }
        }
        case 'Boolean': {
          let boolValue: boolean | null = null
          if (typeof rawValue === 'boolean') {
            boolValue = rawValue
          } else if (typeof rawValue === 'string') {
            if (rawValue === 'true') boolValue = true
            if (rawValue === 'false') boolValue = false
          }
          if (boolValue === null) return null
          return {
            storedValue: boolValue,
            customValue: boolValue,
            dataType: 'boolean',
          }
        }
        case 'Date and Time': {
          let date: Date | null = null
          if (rawValue instanceof Date) {
            date = rawValue
          } else if (rawValue && typeof rawValue === 'object' && 'toDate' in (rawValue as any)) {
            try {
              const converted = (rawValue as any).toDate()
              if (converted instanceof Date) {
                date = converted
              }
            } catch (error) {
              date = null
            }
          } else if (typeof rawValue === 'string') {
            const parsed = new Date(rawValue)
            if (!Number.isNaN(parsed.getTime())) {
              date = parsed
            }
          }
          if (!date) return null
          const iso = date.toISOString()
          return {
            storedValue: iso,
            customValue: iso,
            dataType: 'date',
          }
        }
        default: {
          const text = String(rawValue)
          if (!text.trim() && !field.required) {
            return null
          }
          return {
            storedValue: text,
            customValue: text,
            dataType: 'string',
          }
        }
      }
    },
    []
  )

  const buildFieldPayload = useCallback(
    (overrides?: Record<string, unknown>) => {
      const dynamicProps: Record<string, any> = {}
      const customFields: BlockField[] = []
      const missingRequired: string[] = []

      combinedFieldDefinitions.forEach((field) => {
        const key = getFieldKey(field)
        const overrideValue = overrides && overrides[key]
        const shouldUseOverride = overrideValue !== undefined && overrideValue !== null && overrideValue !== ''
        const sourceValue = shouldUseOverride ? overrideValue : fieldValues[key]
        const normalized = normalizeFieldValue(field, sourceValue)
        if (!normalized) {
          if (field.required && !shouldUseOverride && mode !== 'edit') {
            missingRequired.push(field.label)
          }
          return
        }
        dynamicProps[key] = normalized.storedValue
        customFields.push({
          key,
          label: field.label,
          value: normalized.customValue,
          dataType: normalized.dataType,
        })
      })

      return { dynamicProps, customFields, missingRequired }
    },
    [combinedFieldDefinitions, fieldValues, getFieldKey, mode, normalizeFieldValue]
  )

  const groupedCustomFields = useMemo(() => {
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

  const handleFieldValueChange = useCallback((key: string, value: any) => {
    setFieldValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const renderFieldControl = useCallback(
    (field: BlockFieldDefinition) => {
      const key = getFieldKey(field)
      const value = fieldValues[key]
      const required = Boolean(field.required)
      const suffix = field.suffix ? ` ${field.suffix}` : ''

      switch (field.type) {
        case 'Number':
        case 'CV Number':
          return (
            <div key={key} className="space-y-1">
              <Label>{field.label}{required ? ' *' : ''}{suffix}</Label>
              <Input
                type="number"
                value={value ?? ''}
                onChange={(event) => handleFieldValueChange(key, event.target.value)}
                min={field.min}
                max={field.max}
                step={field.step}
              />
            </div>
          )
        case 'Select':
          return (
            <div key={key} className="space-y-1">
              <Label>{field.label}{required ? ' *' : ''}</Label>
              <select
                className="input"
                value={value ?? ''}
                onChange={(event) => handleFieldValueChange(key, event.target.value)}
              >
                <option value="">Select…</option>
                {(field.options || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )
        case 'Boolean': {
          const boolValue = value === true ? 'true' : value === false ? 'false' : ''
          return (
            <div key={key} className="space-y-1">
              <Label>{field.label}{required ? ' *' : ''}</Label>
              <select
                className="input"
                value={boolValue}
                onChange={(event) => {
                  const next = event.target.value
                  if (next === '') {
                    handleFieldValueChange(key, '')
                  } else {
                    handleFieldValueChange(key, next === 'true')
                  }
                }}
              >
                <option value="">Select…</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          )
        }
        case 'Date and Time':
          return (
            <div key={key} className="space-y-1">
              <Label>{field.label}{required ? ' *' : ''}</Label>
              <Input
                type={field.includeTime ? 'datetime-local' : 'date'}
                value={value ?? ''}
                onChange={(event) => handleFieldValueChange(key, event.target.value)}
              />
            </div>
          )
        case 'Formatted Text':
          return (
            <div key={key} className="space-y-1">
              <Label>{field.label}{required ? ' *' : ''}</Label>
              <textarea
                className="input min-h-[90px]"
                value={value ?? ''}
                onChange={(event) => handleFieldValueChange(key, event.target.value)}
              />
            </div>
          )
        case 'Image':
          return (
            <div key={key} className="space-y-1 text-xs text-gray-500">
              <Label>{field.label}</Label>
              <p>Image uploads are not yet supported in this interface.</p>
            </div>
          )
        default:
          return (
            <div key={key} className="space-y-1">
              <Label>{field.label}{required ? ' *' : ''}{suffix}</Label>
              <Input
                value={value ?? ''}
                onChange={(event) => handleFieldValueChange(key, event.target.value)}
              />
            </div>
          )
      }
    },
    [fieldValues, getFieldKey, handleFieldValueChange]
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const importedCount = importedFeatures?.features?.length ?? 0
    const singleGeometry =
      draftGeometry || (importedCount === 1 ? (importedFeatures!.features[0].geometry as GeoJSON.Geometry | null) : null)

    if (!singleGeometry && importedCount === 0) {
      showAlert('Draw a block polygon on the map or import a GIS file before saving.', 'error')
      return
    }

    setLoading(true)

    try {
      const baseInputCore: CreateBlockInput = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        variety: form.variety.trim() || undefined,
        plantingYear: form.plantingYear ? Number(form.plantingYear) : undefined,
        rowSpacing: form.rowSpacing ? Number(form.rowSpacing) : undefined,
        vineSpacing: form.vineSpacing ? Number(form.vineSpacing) : undefined,
        geometry: (singleGeometry as GeoJSON.Polygon | GeoJSON.MultiPolygon) ?? (draftGeometry as GeoJSON.Polygon | GeoJSON.MultiPolygon),
      }

      let baseFieldPayload = buildFieldPayload()
      if (importedCount === 1 && importedFeatures) {
        const firstFeature = importedFeatures.features[0]
        baseFieldPayload = buildFieldPayload((firstFeature?.properties || {}) as Record<string, unknown>)
      }

      if (mode !== 'edit' && importedCount <= 1 && baseFieldPayload.missingRequired.length) {
        showAlert(`Required field missing: ${baseFieldPayload.missingRequired.join(', ')}`, 'error')
        setLoading(false)
        return
      }

      const baseInputWithFields: any = {
        ...baseInputCore,
        ...baseFieldPayload.dynamicProps,
      }
      if (baseFieldPayload.customFields.length) {
        baseInputWithFields.customFields = baseFieldPayload.customFields
      }

      if (mode === 'edit' && block) {
        const payload: UpdateBlockInput & { revisionMessage?: string } = {
          ...baseInputWithFields,
          revisionMessage: revisionMessage.trim() || undefined,
        }

        await onUpdate(block.id, payload)
        await onRefetch?.()
        showAlert('Block updated successfully.', 'success')
      } else {
        if (importedCount > 1) {
          const createPromises: Promise<any>[] = []
          importedFeatures!.features.forEach((feature, index) => {
            const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | null
            if (!geometry) return
            const properties = (feature.properties || {}) as Record<string, unknown>
            const blockName = deriveNameFromFeature(properties, form.name, nameHeader, index)
            const fieldPayload = buildFieldPayload(properties)
            const input: CreateBlockInput = {
              ...(baseInputCore as any),
              name: blockName,
              geometry,
            }
            const extendedInput: any = {
              ...input,
              ...fieldPayload.dynamicProps,
            }
            if (fieldPayload.customFields.length) {
              extendedInput.customFields = fieldPayload.customFields
            }
            createPromises.push(onCreate(extendedInput))
          })
          await Promise.all(createPromises)
          await onRefetch?.()
          showAlert(`Created ${createPromises.length} blocks from import.`, 'success')
        } else {
          await onCreate(baseInputWithFields)
          await onRefetch?.()
          showAlert('Block created successfully.', 'success')
        }
        clearDraftFeatures()
        clearDraftSource()
        resetForm()
      }

      onClose()
    } catch (error: any) {
      console.error('Failed to save block:', error)
      showAlert(error?.response?.data?.message || 'Failed to save block. Try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!block) return
    const confirmed = window.confirm('Delete this block? This action cannot be undone.')
    if (!confirmed) return

    try {
      setLoading(true)
      await onDelete(block.id)
      await onRefetch?.()
      showAlert('Block deleted successfully.', 'success')
      clearDraftFeatures()
      clearDraftSource()
      onClose()
    } catch (error: any) {
      console.error('Failed to delete block:', error)
      showAlert(error?.response?.data?.message || 'Failed to delete block.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const disableSubmit = useMemo(() => {
    if (!form.name.trim()) return true
    if (loading) return true
    return false
  }, [form.name, loading])

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => {
        if (!loading) {
          onClose()
        }
      }}
      title={mode === 'edit' ? 'Edit Block' : 'Create Block'}
      showBackdrop
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="space-y-3">
          <div>
            <Label htmlFor="block-name">Block Name</Label>
            <Input
              id="block-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="block-description">Description</Label>
            <textarea
              id="block-description"
              className="input min-h-[90px]"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="block-variety">Variety</Label>
              <Input
                id="block-variety"
                value={form.variety}
                onChange={(event) => setForm((prev) => ({ ...prev, variety: event.target.value }))}
                placeholder="e.g. Cabernet Sauvignon"
              />
            </div>
            <div>
              <Label htmlFor="block-planting-year">Planting Year</Label>
              <Input
                id="block-planting-year"
                type="number"
                value={form.plantingYear}
                onChange={(event) => setForm((prev) => ({ ...prev, plantingYear: event.target.value }))}
                min="1900"
                max={new Date().getFullYear() + 10}
              />
            </div>
            <div>
              <Label htmlFor="block-row-spacing">Row Spacing (m)</Label>
              <Input
                id="block-row-spacing"
                type="number"
                step="0.1"
                value={form.rowSpacing}
                onChange={(event) => setForm((prev) => ({ ...prev, rowSpacing: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="block-vine-spacing">Vine Spacing (m)</Label>
              <Input
                id="block-vine-spacing"
                type="number"
                step="0.1"
                value={form.vineSpacing}
                onChange={(event) => setForm((prev) => ({ ...prev, vineSpacing: event.target.value }))}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Block Footprint</h4>
              <p className="text-xs text-gray-500">
                Draw directly on the map or upload a GeoJSON / zipped shapefile to import polygons.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.geojson,.zip"
              onChange={handleFileChange}
              className="text-xs"
            />
          </div>

          {loadingFromFile && (
            <p className="text-xs text-blue-600">Processing uploaded GIS file…</p>
          )}

          {!draftGeometry && !loadingFromFile && (
            <p className="text-sm text-amber-600">
              No polygon captured yet. Use the drawing tools on the map or upload a GIS file.
            </p>
          )}

          {bulkHeaders.length > 0 && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-blue-700">Imported Headers</h5>
              <p className="mt-1 text-xs text-blue-600">
                Select a header to use as the block name when creating multiple blocks.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {bulkHeaders.map((header) => (
                  <button
                    key={header.name}
                    type="button"
                    onClick={() => setNameHeader(header.name)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      nameHeader === header.name
                        ? 'border-blue-500 bg-white text-blue-600 shadow-sm'
                        : 'border-blue-200 bg-blue-100 text-blue-700'
                    }`}
                  >
                    {header.name}
                    <span className="ml-1 text-[10px] uppercase">
                      {header.type === 'Number' ? 'Number' : 'Text'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {groupedCustomFields.length > 0 && (
          <section className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900">Additional Fields</h4>
            {groupedCustomFields.map(([groupName, fields]) => (
              <div key={groupName} className="space-y-3">
                {groupName !== 'Details' && <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{groupName}</h5>}
                <div className="grid gap-3">
                  {fields.map((field) => renderFieldControl(field))}
                </div>
              </div>
            ))}
          </section>
        )}

        {mode === 'edit' && (
          <section>
            <Label htmlFor="block-revision">Revision Note</Label>
            <textarea
              id="block-revision"
              className="input min-h-[90px]"
              value={revisionMessage}
              onChange={(event) => setRevisionMessage(event.target.value)}
              placeholder="Describe what changed in this update (optional)"
            />
          </section>
        )}

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
          {mode === 'edit' && block && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="sm:mr-auto"
            >
              Delete Block
            </Button>
          )}

          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={disableSubmit}>
            {loading ? (mode === 'edit' ? 'Saving…' : 'Creating…') : mode === 'edit' ? 'Save Changes' : 'Create Block'}
          </Button>
        </div>
      </form>
    </Drawer>
  )
}

function normalizeGeoJson(geojson: any): GeoJSON.FeatureCollection {
  if (!geojson) {
    throw new Error('Missing GeoJSON data')
  }

  if (geojson.type === 'FeatureCollection') {
    return geojson as GeoJSON.FeatureCollection
  }

  if (geojson.type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [geojson],
    }
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: geojson,
        properties: {},
      },
    ],
  }
}

function deriveHeadersFromFeature(feature: GeoJSON.Feature): BulkHeaderDefinition[] {
  const props = (feature.properties || {}) as Record<string, unknown>
  const restricted = new Set(['createdBy', 'createdOn', 'updatedOn', 'updatedBy', 'farmId', 'blockId', 'footprint', 'area'])
  const headers: BulkHeaderDefinition[] = []

  Object.keys(props).forEach((key, index) => {
    if (restricted.has(key)) return
    const value = props[key]
    const header: BulkHeaderDefinition = {
      name: key,
      type: typeof value === 'number' ? 'Number' : 'Text',
      nameField: index === 0,
    }
    headers.push(header)
  })

  return headers
}

function deriveNameFromFeature(
  properties: Record<string, unknown>,
  fallbackName: string,
  nameHeader: string | null,
  index: number
): string {
  if (typeof properties.name === 'string' && properties.name.trim()) {
    return properties.name.trim()
  }
  if (nameHeader && typeof properties[nameHeader] === 'string') {
    const candidate = String(properties[nameHeader]).trim()
    if (candidate) return candidate
  }
  if (index === 0) {
    return fallbackName || `Imported Block`
  }
  return `${fallbackName || 'Imported Block'} ${index + 1}`
}


