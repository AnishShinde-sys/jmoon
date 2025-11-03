"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

import { useMapContext } from '@/context/MapContext'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'
import { CreateBlockInput, BlockField, UpdateBlockInput } from '@/types/block'

import { PlusIcon, XMarkIcon, TrashIcon, CalendarIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export type BlockEditorState =
  | { mode: 'hidden' }
  | { mode: 'create' }
  | { mode: 'edit'; block?: any; blockId?: string }

interface BlockEditorPanelProps {
  farmId: string
  state: BlockEditorState
  createBlock: (input: CreateBlockInput) => Promise<any>
  updateBlock: (
    blockId: string,
    input: UpdateBlockInput & { revisionMessage?: string }
  ) => Promise<any>
  deleteBlock: (blockId: string) => Promise<void>
  refetchBlocks?: () => Promise<void>
  onRequestClose: () => void
}

interface BlockData {
  id: string
  name: string
  farmId?: string
  variety?: string
  plantingYear?: number
  rowSpacing?: number
  vineSpacing?: number
  area?: number
  customFields?: BlockField[]
  createdAt?: string
  updatedAt?: string
  updatedByName?: string
  revisionMessage?: string
  geometry?: GeoJSON.Geometry
  [key: string]: any
}

type FormValues = {
  name: string
  variety: string
  plantingYear: number
  rowSpacing: string
  vineSpacing: string
}

type FormSnapshot = {
  formData: FormValues
  customFields: BlockField[]
  revisionMessage: string
  geometry: GeoJSON.Geometry | null
}

export default function BlockEditorPanel({
  farmId,
  state,
  createBlock,
  updateBlock,
  deleteBlock,
  refetchBlocks,
  onRequestClose,
}: BlockEditorPanelProps) {
  const { draw } = useMapContext()
  const { openDrawer, showAlert } = useUI()

  const [mode, setMode] = useState<'hidden' | 'create' | 'edit'>('hidden')
  const [currentBlock, setCurrentBlock] = useState<BlockData | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const [formData, setFormData] = useState<FormValues>({
    name: '',
    variety: '',
    plantingYear: new Date().getFullYear(),
    rowSpacing: '',
    vineSpacing: '',
  })
  const [customFields, setCustomFields] = useState<BlockField[]>([])
  const [revisionMessage, setRevisionMessage] = useState('')
  const [drawnGeometry, setDrawnGeometry] = useState<GeoJSON.Geometry | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [initialSnapshot, setInitialSnapshot] = useState<FormSnapshot | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      variety: '',
      plantingYear: new Date().getFullYear(),
      rowSpacing: '',
      vineSpacing: '',
    })
    setCustomFields([])
    setRevisionMessage('')
    setDrawnGeometry(null)
    setInitialSnapshot(null)
  }, [])

  const clearDraftFeatures = useCallback(
    (options?: { includePersisted?: boolean }) => {
      if (!draw) return

      try {
        const includePersisted = options?.includePersisted ?? false
        const features = draw.getAll().features
        if (!features.length) return

        const idsToDelete = features
          .filter((feature: any) => {
            const isPersisted = Boolean(feature?.properties?.__persisted)
            return includePersisted ? true : !isPersisted
          })
          .map((feature: any) => feature.id)
          .filter((id: unknown): id is string => typeof id === 'string')

        if (idsToDelete.length) {
          draw.delete(idsToDelete)
        }
      } catch (error) {
        console.warn('Failed to clear draft features:', error)
      }
    },
    [draw]
  )

  const syncDraftGeometry = useCallback(() => {
    if (!draw) return

    try {
      const draftFeature = draw
        .getAll()
        .features.find((feature: any) => !feature?.properties?.__persisted)

      if (draftFeature?.geometry) {
        setDrawnGeometry(draftFeature.geometry as GeoJSON.Geometry)
      }
    } catch (error) {
      console.warn('Failed to sync draft geometry:', error)
    }
  }, [draw])

  const closePanel = useCallback(() => {
    setMode('hidden')
    setCurrentBlock(null)
    setEditingBlockId(null)
    resetForm()
    onRequestClose()
  }, [onRequestClose, resetForm])

  const normalizeCustomFields = useCallback((fields: unknown): BlockField[] => {
    if (!Array.isArray(fields)) {
      return []
    }

    return fields.map((field, index) => {
      const typedField = field as BlockField
      const fallbackKey = typedField.key ?? `${typedField.label ?? 'field'}_${index}`
      return {
        ...typedField,
        key: fallbackKey,
      }
    })
  }, [])

  const fillFormFromBlock = useCallback(
    (block: BlockData): FormSnapshot => {
      const normalizedFields = normalizeCustomFields(block.customFields)
      const values: FormValues = {
        name: block.name || '',
        variety: block.variety || '',
        plantingYear: block.plantingYear || new Date().getFullYear(),
        rowSpacing: block.rowSpacing != null ? String(block.rowSpacing) : '',
        vineSpacing: block.vineSpacing != null ? String(block.vineSpacing) : '',
      }

      setFormData(values)
      setCustomFields(normalizedFields)
      setRevisionMessage(block.revisionMessage || '')
      setDrawnGeometry((block.geometry as GeoJSON.Geometry) || null)

      return {
        formData: values,
        customFields: normalizedFields.map((field) => ({ ...field })),
        revisionMessage: block.revisionMessage || '',
        geometry: block.geometry ? (block.geometry as GeoJSON.Geometry) : null,
      }
    },
    [normalizeCustomFields]
  )

  const enterCreateMode = useCallback(() => {
    setMode('create')
    setCurrentBlock(null)
    setEditingBlockId(null)
    setDetailsLoading(false)
    resetForm()
    syncDraftGeometry()
  }, [resetForm, syncDraftGeometry])

  const enterEditMode = useCallback(
    (block: BlockData) => {
      const normalizedBlock: BlockData = {
        ...block,
        customFields: normalizeCustomFields(block.customFields),
      }

      const snapshot = fillFormFromBlock(normalizedBlock)

      setMode('edit')
      setCurrentBlock({
        ...normalizedBlock,
        customFields: snapshot.customFields.map((field) => ({ ...field })),
      })
      setEditingBlockId(normalizedBlock.id)
      setDetailsLoading(false)
      setInitialSnapshot({
        ...snapshot,
        customFields: snapshot.customFields.map((field) => ({ ...field })),
        geometry: snapshot.geometry ? JSON.parse(JSON.stringify(snapshot.geometry)) : null,
      })
    },
    [fillFormFromBlock, normalizeCustomFields]
  )

  const loadBlockDetails = useCallback(
    async (blockId: string) => {
      setMode('edit')
      setCurrentBlock(null)
      setEditingBlockId(blockId)
      resetForm()
      setDrawnGeometry(null)
      setDetailsLoading(true)
      try {
        const response = await apiClient.get(`/api/farms/${farmId}/blocks/${blockId}`)
        const feature = response.data
        const blockData: BlockData = {
          ...(feature.properties || feature),
          geometry: feature.geometry,
        }
        enterEditMode(blockData)
      } catch (error: any) {
        showAlert(error?.response?.data?.message || 'Failed to load block', 'error')
        closePanel()
      } finally {
        setDetailsLoading(false)
      }
    },
    [closePanel, enterEditMode, farmId, resetForm, setDrawnGeometry, showAlert]
  )

  useEffect(() => {
    if (!state) {
      setMode('hidden')
      setCurrentBlock(null)
      setEditingBlockId(null)
      resetForm()
      return
    }

    switch (state.mode) {
      case 'hidden':
        setMode('hidden')
        setCurrentBlock(null)
        setEditingBlockId(null)
        resetForm()
        break
      case 'create':
        enterCreateMode()
        break
      case 'edit':
        if (state.block) {
          enterEditMode(state.block as BlockData)
        } else if (state.blockId) {
          loadBlockDetails(state.blockId)
        }
        break
      default:
        break
    }
  }, [state, enterCreateMode, enterEditMode, loadBlockDetails, resetForm])

  useEffect(() => {
    if (!draw || mode === 'hidden') return
    if (drawnGeometry) return
    syncDraftGeometry()
  }, [draw, drawnGeometry, mode, syncDraftGeometry])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!drawnGeometry) {
      showAlert('Draw a block polygon before saving.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const input: CreateBlockInput & { revisionMessage?: string } = {
        name: formData.name,
        variety: formData.variety || undefined,
        plantingYear: formData.plantingYear || undefined,
        rowSpacing: formData.rowSpacing ? Number(formData.rowSpacing) : undefined,
        vineSpacing: formData.vineSpacing ? Number(formData.vineSpacing) : undefined,
        geometry: drawnGeometry,
        customFields: customFields.length > 0 ? customFields : undefined,
      }

      if (mode === 'edit' && editingBlockId) {
        const payload: UpdateBlockInput & { revisionMessage?: string } = {
          ...input,
          revisionMessage: revisionMessage.trim() ? revisionMessage.trim() : undefined,
        }

        const response = await updateBlock(editingBlockId, payload)
        await refetchBlocks?.()

        const feature = response
        const updatedBlock: BlockData = {
          ...(feature.properties || feature),
          geometry: feature.geometry,
        }

        showAlert('Block updated successfully', 'success')
        enterEditMode(updatedBlock)
      } else {
        await createBlock(input)
        await refetchBlocks?.()
        showAlert('Block created successfully', 'success')
        clearDraftFeatures()
        closePanel()
      }
    } catch (error: any) {
      showAlert(error?.response?.data?.message || `Failed to ${mode === 'edit' ? 'update' : 'create'} block`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        key: `field_${prev.length}_${editingBlockId ?? 'new'}`,
        label: '',
        value: '',
        dataType: 'string',
      },
    ])
  }

  const updateCustomField = (index: number, updates: Partial<BlockField>) => {
    setCustomFields((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index))
  }

  const handleViewRevisions = () => {
    if (!editingBlockId) return
    openDrawer('blockRevisions', editingBlockId)
  }

  const handleDelete = async () => {
    if (!editingBlockId || !currentBlock) return

    const confirmed = window.confirm(`Delete "${currentBlock.name}"? This cannot be undone.`)
    if (!confirmed) return

    try {
      await deleteBlock(editingBlockId)
      await refetchBlocks?.()
      showAlert('Block deleted successfully', 'success')
      clearDraftFeatures({ includePersisted: true })
      closePanel()
    } catch (error: any) {
      showAlert(error?.response?.data?.message || 'Failed to delete block', 'error')
    }
  }

  const handleRedraw = () => {
    clearDraftFeatures()
    setDrawnGeometry(null)
    onRequestClose()
    showAlert('Draw a new block polygon to continue.', 'info')
  }

  const title = useMemo(() => {
    if (mode === 'create') return 'Create Block'
    if (currentBlock?.name) return currentBlock.name
    if (mode === 'edit') return 'Edit Block'
    return 'Block'
  }, [currentBlock?.name, mode])

  const currentSnapshotString = useMemo(() => {
    if (mode === 'hidden') return ''
    const snapshot: FormSnapshot = {
      formData,
      customFields: customFields.map((field) => ({ ...field })),
      revisionMessage,
      geometry: drawnGeometry ? JSON.parse(JSON.stringify(drawnGeometry)) : null,
    }
    return JSON.stringify(snapshot)
  }, [mode, formData, customFields, revisionMessage, drawnGeometry])

  const initialSnapshotString = useMemo(
    () => (initialSnapshot ? JSON.stringify(initialSnapshot) : null),
    [initialSnapshot]
  )

  const hasChanges = mode === 'edit' && initialSnapshotString !== currentSnapshotString

  const formattedArea = useMemo(() => {
    if (!currentBlock?.area) return null
    return `${(currentBlock.area / 10000).toFixed(2)} ha`
  }, [currentBlock?.area])

  if (mode === 'hidden') {
    return null
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="text-lg font-semibold text-gray-900">{title}</div>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              className="btn btn-primary btn-sm"
              disabled={!hasChanges || submitting}
            >
              Save Changes
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={closePanel}>
            Close
          </button>
        </div>
      </div>
      <div className="space-y-6 p-4">
        {mode === 'edit' && (
          <div className="space-y-4">
            {detailsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="spinner" />
              </div>
            ) : currentBlock ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-500">Description</label>
                  <p className="mt-1 text-sm text-gray-700">
                    {currentBlock.variety || 'No variety specified'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                  {currentBlock.variety && (
                    <div>
                      <label className="text-xs uppercase tracking-wide text-gray-500">Variety</label>
                      <p className="mt-1 font-medium">{currentBlock.variety}</p>
                    </div>
                  )}
                  {currentBlock.plantingYear && (
                    <div>
                      <label className="text-xs uppercase tracking-wide text-gray-500">Planting Year</label>
                      <p className="mt-1 font-medium">{currentBlock.plantingYear}</p>
                    </div>
                  )}
                  {currentBlock.rowSpacing != null && (
                    <div>
                      <label className="text-xs uppercase tracking-wide text-gray-500">Row Spacing</label>
                      <p className="mt-1 font-medium">{currentBlock.rowSpacing} m</p>
                    </div>
                  )}
                  {currentBlock.vineSpacing != null && (
                    <div>
                      <label className="text-xs uppercase tracking-wide text-gray-500">Vine Spacing</label>
                      <p className="mt-1 font-medium">{currentBlock.vineSpacing} m</p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <label className="text-xs uppercase tracking-wide text-gray-500">Area</label>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {formattedArea || 'N/A'}
                  </p>
                </div>

                {Array.isArray(currentBlock.customFields) && currentBlock.customFields.length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <label className="text-xs uppercase tracking-wide text-gray-500">Custom Fields</label>
                    <div className="space-y-2">
                      {currentBlock.customFields.map((field) => (
                        <div key={field.key} className="flex justify-between text-sm">
                          <span className="text-gray-600">{field.label}</span>
                          <span className="font-medium text-gray-900">{String(field.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-2 text-xs text-gray-500">
                  {currentBlock.createdAt && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Created: {new Date(currentBlock.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {currentBlock.updatedAt && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Updated: {new Date(currentBlock.updatedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {currentBlock.updatedByName && (
                    <div>Updated By: {currentBlock.updatedByName}</div>
                  )}
                  {currentBlock.revisionMessage && (
                    <div className="text-gray-600">Last Revision: {currentBlock.revisionMessage}</div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <button
                    onClick={handleDelete}
                    className="w-full btn bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                    type="button"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </button>
                  <button
                    onClick={handleViewRevisions}
                    className="btn btn-secondary flex items-center justify-center gap-2"
                    type="button"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    View Revisions
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Block Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
              placeholder="e.g., Block A"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Variety</label>
            <input
              type="text"
              value={formData.variety}
              onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
              className="input"
              placeholder="e.g., Cabernet Sauvignon"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Planting Year</label>
            <input
              type="number"
              value={formData.plantingYear}
              onChange={(e) =>
                setFormData({ ...formData, plantingYear: Number(e.target.value) })
              }
              className="input"
              min="1900"
              max={new Date().getFullYear() + 10}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Row Spacing (m)</label>
              <input
                type="number"
                value={formData.rowSpacing}
                onChange={(e) =>
                  setFormData({ ...formData, rowSpacing: e.target.value })
                }
                className="input"
                step="0.1"
                min="0"
                placeholder="2.5"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Vine Spacing (m)</label>
              <input
                type="number"
                value={formData.vineSpacing}
                onChange={(e) =>
                  setFormData({ ...formData, vineSpacing: e.target.value })
                }
                className="input"
                step="0.1"
                min="0"
                placeholder="1.5"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Custom Fields (Optional)
              </label>
              <button
                type="button"
                onClick={addCustomField}
                className="btn btn-sm btn-secondary flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add
              </button>
            </div>

            {customFields.length > 0 && (
              <div className="space-y-3">
                {customFields.map((field, index) => (
                  <div key={field.key} className="flex items-start gap-2 rounded-lg bg-gray-50 p-3">
                    <div className="grid flex-1 grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateCustomField(index, { label: e.target.value })}
                        placeholder="Field name"
                        className="input input-sm"
                      />
                      <input
                        type={field.dataType === 'number' ? 'number' : 'text'}
                        value={String(field.value ?? '')}
                        onChange={(e) => updateCustomField(index, { value: e.target.value })}
                        placeholder="Value"
                        className="input input-sm"
                      />
                      <select
                        value={field.dataType}
                        onChange={(e) =>
                          updateCustomField(index, {
                            dataType: e.target.value as BlockField['dataType'],
                          })
                        }
                        className="input input-sm"
                      >
                        <option value="string">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">Yes/No</option>
                        <option value="date">Date</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomField(index)}
                      className="rounded p-2 text-red-600 hover:bg-red-50"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {mode === 'edit' && (
            <div className="border-t pt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Revision Note</label>
              <textarea
                value={revisionMessage}
                onChange={(e) => setRevisionMessage(e.target.value)}
                className="input min-h-[90px]"
                placeholder="Describe what changed in this update (optional)"
              />
            </div>
          )}

          <div className="flex items-center gap-3 border-t pt-4">
            <button
              type="button"
              onClick={handleRedraw}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Redraw
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={submitting || (mode === 'edit' && !hasChanges)}
            >
              {submitting
                ? mode === 'edit'
                  ? 'Updating...'
                  : 'Creating...'
                : mode === 'edit'
                ? 'Update Block'
                : 'Create Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


