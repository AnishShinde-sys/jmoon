"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CreateBlockInput, UpdateBlockInput, Block, BlockFieldDefinition, BlockField } from '@/types/block'
import type { MeasurementSystem } from '@/types/user'
import Modal from '@/components/ui/Modal'

type SubmitPayload =
  | { mode: 'create'; input: CreateBlockInput }
  | { mode: 'edit'; blockId: string; input: UpdateBlockInput }

interface BlockFormModalProps {
  mode: 'create' | 'edit'
  isOpen: boolean
  block?: Block | null
  blockFields?: BlockFieldDefinition[]
  measurementSystem?: MeasurementSystem
  submitting?: boolean
  onClose: () => void
  onSubmit: (payload: SubmitPayload) => Promise<void>
}

type GeometryShape = GeoJSON.Polygon | GeoJSON.MultiPolygon | null

interface GeometryImportResult {
  geometry: GeometryShape
  featureProperties?: Record<string, any> | null
  featureCount: number
}

interface CustomFieldState {
  [machineName: string]: any
}

function mapFieldToDataType(field: BlockFieldDefinition): BlockField['dataType'] {
  switch (field.type) {
    case 'Number':
    case 'CV Number':
      return 'number'
    case 'Boolean':
      return 'boolean'
    case 'Date and Time':
      return 'date'
    default:
      return 'string'
  }
}

function isPolygonGeometry(geometry: any): geometry is GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (!geometry) return false
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') return true
  return false
}

function extractGeometryFromGeoJson(data: any): GeometryImportResult {
  if (!data) {
    return { geometry: null, featureProperties: null, featureCount: 0 }
  }

  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    const polygonFeature = data.features.find((feature: any) => isPolygonGeometry(feature?.geometry))
    return {
      geometry: polygonFeature?.geometry ?? null,
      featureProperties: polygonFeature?.properties ?? null,
      featureCount: data.features.length,
    }
  }

  if (data.type === 'Feature') {
    return {
      geometry: isPolygonGeometry(data.geometry) ? data.geometry : null,
      featureProperties: data.properties ?? null,
      featureCount: 1,
    }
  }

  if (isPolygonGeometry(data)) {
    return {
      geometry: data,
      featureProperties: null,
      featureCount: 1,
    }
  }

  return { geometry: null, featureProperties: null, featureCount: 0 }
}

function formatGeometrySummary(geometry: GeometryShape): string {
  if (!geometry) return 'No geometry selected'
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates.length
    return `Polygon · ${rings} ring${rings === 1 ? '' : 's'}`
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates.length
    return `MultiPolygon · ${polygons} polygon${polygons === 1 ? '' : 's'}`
  }
  return 'Geometry selected'
}

function createInitialCustomFieldState(
  block: Block | null | undefined,
  blockFields: BlockFieldDefinition[] | undefined
): CustomFieldState {
  if (!blockFields || blockFields.length === 0) return {}

  const state: CustomFieldState = {}

  blockFields.forEach((field) => {
    if (field.hidden) return

    const fromCustomFields = block?.customFields?.find(
      (customField) => customField.key === field.machineName || customField.key === field.label
    )

    if (fromCustomFields) {
      state[field.machineName] = fromCustomFields.value
      return
    }

    const directValue = block ? (block as Record<string, any>)[field.machineName] : undefined
    if (directValue !== undefined) {
      state[field.machineName] = directValue
      return
    }

    const labelValue = block ? (block as Record<string, any>)[field.label] : undefined
    if (labelValue !== undefined) {
      state[field.machineName] = labelValue
    }
  })

  return state
}

function convertCustomFieldStateToArray(
  customFieldState: CustomFieldState,
  blockFields: BlockFieldDefinition[] | undefined
): BlockField[] | undefined {
  if (!blockFields || blockFields.length === 0) return undefined

  const entries: BlockField[] = []

  blockFields.forEach((definition) => {
    if (definition.hidden) return

    if (customFieldState[definition.machineName] !== undefined) {
      entries.push({
        key: definition.machineName,
        label: definition.label,
        value: customFieldState[definition.machineName],
        dataType: mapFieldToDataType(definition),
      })
    }
  })

  return entries.length ? entries : undefined
}

async function parseShapefile(file: File): Promise<any> {
  const buffer = await file.arrayBuffer()
  const shpjs = await import('shpjs')
  return shpjs.default(buffer)
}

export default function BlockFormModal({
  mode,
  isOpen,
  block,
  blockFields,
  measurementSystem,
  submitting,
  onClose,
  onSubmit,
}: BlockFormModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [variety, setVariety] = useState('')
  const [plantingYear, setPlantingYear] = useState<string>('')
  const [rowSpacing, setRowSpacing] = useState<string>('')
  const [vineSpacing, setVineSpacing] = useState<string>('')
  const [revisionMessage, setRevisionMessage] = useState('')
  const [geometry, setGeometry] = useState<GeometryShape>(null)
  const [geometryChanged, setGeometryChanged] = useState(false)
  const [geometryMessage, setGeometryMessage] = useState<string>('')
  const [featureCount, setFeatureCount] = useState<number>(0)
  const [customFieldState, setCustomFieldState] = useState<CustomFieldState>({})
  const [error, setError] = useState<string | null>(null)

  const isEdit = mode === 'edit'

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setName(block?.name ?? '')
    setDescription(block?.description ?? '')
    setVariety(block?.variety ?? '')
    setPlantingYear(block?.plantingYear ? String(block.plantingYear) : '')
    setRowSpacing(block?.rowSpacing !== undefined ? String(block.rowSpacing) : '')
    setVineSpacing(block?.vineSpacing !== undefined ? String(block.vineSpacing) : '')
    setRevisionMessage('')
    setGeometry(block?.geometry ?? null)
    setGeometryChanged(false)
    setFeatureCount(block?.geometry ? 1 : 0)
    setError(null)

    const initialCustomFields = createInitialCustomFieldState(block ?? null, blockFields)
    setCustomFieldState(initialCustomFields)
  }, [isOpen, block, blockFields])

  const handleFileImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        let data: any
        if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
          const text = await file.text()
          data = JSON.parse(text)
        } else if (file.name.endsWith('.zip')) {
          data = await parseShapefile(file)
        } else {
          throw new Error('Unsupported file type. Please upload a GeoJSON, JSON, or zipped shapefile.')
        }

        const { geometry: importedGeometry, featureProperties, featureCount: importedCount } = extractGeometryFromGeoJson(data)

        if (!importedGeometry) {
          throw new Error('No polygon geometry found in the file. Please make sure the file contains polygons.')
        }

        setGeometry(importedGeometry)
        setGeometryChanged(true)
        setFeatureCount(importedCount)
        setError(null)

        if (importedCount > 1) {
          setGeometryMessage(`Using the first polygon from ${importedCount} features in the uploaded file.`)
        } else {
          setGeometryMessage('Geometry imported successfully.')
        }

        if (featureProperties) {
          if (!name && featureProperties.name) {
            setName(String(featureProperties.name))
          }

          setCustomFieldState((prev) => {
            if (!blockFields || blockFields.length === 0) return prev
            const next = { ...prev }
            blockFields.forEach((field) => {
              if (field.hidden) return

              const value = featureProperties[field.machineName] ?? featureProperties[field.label]
              if (value !== undefined && (next[field.machineName] === undefined || next[field.machineName] === '')) {
                next[field.machineName] = value
              }
            })
            return next
          })
        }
      } catch (err: any) {
        console.error(err)
        setError(err?.message || 'Failed to import geometry. Please check the file and try again.')
      }
    },
    [blockFields, featureCount, name]
  )

  const handleGeometryPaste = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value
      if (!value.trim()) {
        setGeometry(null)
        setGeometryChanged(false)
        setFeatureCount(0)
        setGeometryMessage('')
        return
      }

      try {
        const data = JSON.parse(value)
        const { geometry: importedGeometry, featureProperties, featureCount: importedCount } = extractGeometryFromGeoJson(data)

        if (!importedGeometry) {
          throw new Error('Unable to find a polygon geometry in the provided GeoJSON.')
        }

        setGeometry(importedGeometry)
        setGeometryChanged(true)
        setFeatureCount(importedCount)
        setGeometryMessage(importedCount > 1 ? `Using the first polygon from ${importedCount} features.` : 'Geometry parsed successfully.')
        setError(null)

        if (featureProperties) {
          if (!name && featureProperties.name) {
            setName(String(featureProperties.name))
          }

          setCustomFieldState((prev) => {
            if (!blockFields || blockFields.length === 0) return prev
            const next = { ...prev }
            blockFields.forEach((field) => {
              if (field.hidden) return

              const valueCandidate = featureProperties[field.machineName] ?? featureProperties[field.label]
              if (
                valueCandidate !== undefined &&
                (next[field.machineName] === undefined || next[field.machineName] === '')
              ) {
                next[field.machineName] = valueCandidate
              }
            })
            return next
          })
        }
      } catch (err: any) {
        console.error(err)
        setError(err?.message || 'Failed to parse GeoJSON. Please verify the structure.')
      }
    },
    [blockFields, name]
  )

  const handleCustomFieldChange = useCallback((machineName: string, value: any) => {
    setCustomFieldState((prev) => ({
      ...prev,
      [machineName]: value,
    }))
  }, [])

  const validateForm = useCallback(() => {
    if (!name.trim()) {
      return 'Block name is required.'
    }

    if (mode === 'create' && !geometry) {
      return 'A block geometry is required. Import a GeoJSON polygon or draw one on the map.'
    }

    return null
  }, [geometry, mode, name])

  const handleSubmit = useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    const numericOrUndefined = (value: string) => {
      if (value === undefined || value === null || value === '') return undefined
      const parsed = Number(value)
      return Number.isNaN(parsed) ? undefined : parsed
    }

    const baseFields = {
      name: name.trim(),
      description: description.trim() || undefined,
      variety: variety.trim() || undefined,
      plantingYear: numericOrUndefined(plantingYear),
      rowSpacing: numericOrUndefined(rowSpacing),
      vineSpacing: numericOrUndefined(vineSpacing),
    }

    const customFieldsArray = convertCustomFieldStateToArray(customFieldState, blockFields)

    if (mode === 'create') {
      const input: CreateBlockInput = {
        ...baseFields,
        geometry: geometry!,
        customFields: customFieldsArray,
      }

      await onSubmit({ mode: 'create', input })
      onClose()
      return
    }

    if (!block) {
      setError('Unable to update block because no block is selected.')
      return
    }

    const updateInput: UpdateBlockInput = {
      ...baseFields,
      customFields: customFieldsArray,
      revisionMessage: revisionMessage.trim() || undefined,
    }

    if (geometryChanged && geometry) {
      updateInput.geometry = geometry
    }

    await onSubmit({ mode: 'edit', blockId: block.id, input: updateInput })
    onClose()
  }, [
    block,
    blockFields,
    customFieldState,
    description,
    geometry,
    geometryChanged,
    mode,
    name,
    onClose,
    onSubmit,
    plantingYear,
    revisionMessage,
    rowSpacing,
    validateForm,
    variety,
    vineSpacing,
  ])

  const disableSubmit = submitting

  const primaryActionLabel = isEdit ? 'Save Changes' : 'Create Block'

  const measurementHint = useMemo(() => {
    if (measurementSystem === 'Imperial') {
      return 'Area is stored in acres (calculated automatically from geometry).'
    }
    return 'Area is stored in hectares (calculated automatically from geometry).'
  }, [measurementSystem])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${block?.name ?? 'Block'}` : 'Create Block'} size="2xl">
      <div className="space-y-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Name *</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Block name"
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Variety</span>
              <input
                type="text"
                value={variety}
                onChange={(event) => setVariety(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="e.g. Cabernet Sauvignon"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Planting Year</span>
              <input
                type="number"
                value={plantingYear}
                onChange={(event) => setPlantingYear(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                min={1800}
                max={new Date().getFullYear() + 1}
                placeholder="YYYY"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Row Spacing (m)</span>
              <input
                type="number"
                step="0.01"
                value={rowSpacing}
                onChange={(event) => setRowSpacing(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="e.g. 2.5"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Vine Spacing (m)</span>
              <input
                type="number"
                step="0.01"
                value={vineSpacing}
                onChange={(event) => setVineSpacing(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="e.g. 1.0"
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Notes about this block"
            />
          </label>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Geometry</h3>
              <p className="text-xs text-gray-500">{measurementHint}</p>
            </div>
            {geometry && (
              <button
                type="button"
                onClick={() => {
                  setGeometry(null)
                  setGeometryChanged(true)
                  setFeatureCount(0)
                }}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Clear Geometry
              </button>
            )}
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p>{formatGeometrySummary(geometry)}</p>
            {geometryMessage && <p className="mt-1 text-xs text-gray-500">{geometryMessage}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Import GeoJSON File</span>
              <input
                type="file"
                accept=".geojson,.json,.zip"
                onChange={handleFileImport}
                className="text-sm text-gray-600"
              />
              <p className="text-xs text-gray-500">
                Supported formats: GeoJSON, JSON, or zipped shapefile. We use the first polygon feature in the file.
              </p>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Paste GeoJSON</span>
              <textarea
                rows={6}
                onChange={handleGeometryPaste}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Paste geojson {\"type\": \"Feature\", ...}"
              />
            </label>
          </div>
          {featureCount > 1 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              This file contains {featureCount} features. The first polygon feature is selected for this block.
            </div>
          )}
          {mode === 'edit' && !geometryChanged && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
              Leaving the geometry unchanged will preserve the current block footprint.
            </div>
          )}
        </section>

        {blockFields && blockFields.some((field) => !field.hidden && field.type !== 'Image') && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Block Fields</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {blockFields
                .filter((field) => !field.hidden)
                .map((field) => {
                  const value = customFieldState[field.machineName] ?? ''

                  if (field.type === 'Image') {
                    return (
                      <div key={field.machineName} className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                        {field.label} images are managed in the legacy editor and aren’t editable here yet.
                      </div>
                    )
                  }

                  if (field.type === 'Boolean') {
                    return (
                      <label key={field.machineName} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(event) => handleCustomFieldChange(field.machineName, event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-gray-700">{field.label}</span>
                      </label>
                    )
                  }

                  if (field.type === 'Select' && field.options && field.options.length > 0) {
                    return (
                      <label key={field.machineName} className="space-y-1">
                        <span className="text-sm font-medium text-gray-700">{field.label}</span>
                        <select
                          value={value}
                          onChange={(event) => handleCustomFieldChange(field.machineName, event.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Select…</option>
                          {field.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  }

                  if (field.type === 'Number' || field.type === 'CV Number') {
                    return (
                      <label key={field.machineName} className="space-y-1">
                        <span className="text-sm font-medium text-gray-700">{field.label}</span>
                        <input
                          type="number"
                          value={value}
                          min={field.min}
                          max={field.max}
                          step={field.step ?? 'any'}
                          onChange={(event) => handleCustomFieldChange(field.machineName, event.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        {field.suffix && <span className="text-xs text-gray-500">{field.suffix}</span>}
                      </label>
                    )
                  }

                  if (field.type === 'Date and Time') {
                    const displayValue = value ? new Date(value).toISOString().slice(0, 16) : ''
                    return (
                      <label key={field.machineName} className="space-y-1">
                        <span className="text-sm font-medium text-gray-700">{field.label}</span>
                        <input
                          type="datetime-local"
                          value={displayValue}
                          onChange={(event) => handleCustomFieldChange(field.machineName, event.target.value ? new Date(event.target.value).toISOString() : '')}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </label>
                    )
                  }

                  return (
                    <label key={field.machineName} className="space-y-1">
                      <span className="text-sm font-medium text-gray-700">{field.label}</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(event) => handleCustomFieldChange(field.machineName, event.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </label>
                  )
                })}
            </div>
          </section>
        )}

        {isEdit && (
          <section className="space-y-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Revision Message</span>
              <input
                type="text"
                value={revisionMessage}
                onChange={(event) => setRevisionMessage(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Summarize the changes you made"
              />
              <p className="text-xs text-gray-500">Optional. Helps track updates in revision history.</p>
            </label>
          </section>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            disabled={disableSubmit}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            disabled={disableSubmit}
          >
            {disableSubmit ? 'Saving…' : primaryActionLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

