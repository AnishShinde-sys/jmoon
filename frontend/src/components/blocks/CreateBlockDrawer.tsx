import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useBlocks } from '../../hooks/useBlocks'
import { useMap } from '../../hooks/useMap'
import { useMapContext } from '../../context/MapContext'
import { CreateBlockInput, BlockField } from '../../types/block'
import Drawer from '../ui/Drawer'
import { useUI } from '../../context/UIContext'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

const DRAWER_NAME = 'createBlock'

export default function CreateBlockDrawer() {
  const { farmId } = useParams<{ farmId: string }>()
  const { createBlock, refetch, updateBlock } = useBlocks(farmId || '')
  const { setDrawMode, clearDrawing } = useMap()
  const { map, draw } = useMapContext()
  const { drawers, closeDrawer, showAlert, openDrawer } = useUI()
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    variety: '',
    plantingYear: new Date().getFullYear(),
    rowSpacing: '',
    vineSpacing: '',
  })
  const [customFields, setCustomFields] = useState<BlockField[]>([])
  const [loading, setLoading] = useState(false)
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null)

  // Listen for edit block events
  useEffect(() => {
    const handleEditBlock = (event: CustomEvent) => {
      const { blockId, block } = event.detail
      // Load block data into form
      setFormData({
        name: block.name || '',
        variety: block.variety || '',
        plantingYear: block.plantingYear || new Date().getFullYear(),
        rowSpacing: block.rowSpacing?.toString() || '',
        vineSpacing: block.vineSpacing?.toString() || '',
      })
      setIsEditMode(true)
      setEditingBlockId(blockId)
      // Load geometry if available
      if (block.geometry) {
        setDrawnGeometry(block.geometry)
      }
      // Open the drawer
      openDrawer(DRAWER_NAME)
    }

    window.addEventListener('editBlock', handleEditBlock as EventListener)
    return () => window.removeEventListener('editBlock', handleEditBlock as EventListener)
  }, [openDrawer])

  // Load geometry from draw when drawer opens with a drawing
  useEffect(() => {
    if (!draw || !drawers[DRAWER_NAME]) return

    try {
      // Check if there's a drawn feature
      const features = draw.getAll()
      if (features.features.length > 0 && !drawnGeometry) {
        const feature = features.features[0]
        setDrawnGeometry(feature.geometry)
      }
    } catch (error) {
      // Draw might not be initialized yet
      console.log('Draw not ready yet')
    }
  }, [drawers[DRAWER_NAME], draw, drawnGeometry])

  const cancelDrawing = () => {
    if (draw) {
      clearDrawing()
      draw.changeMode('simple_select')
    }
    setDrawnGeometry(null)
    // Reset form
    setFormData({
      name: '',
      variety: '',
      plantingYear: new Date().getFullYear(),
      rowSpacing: '',
      vineSpacing: '',
    })
    setCustomFields([])
    closeDrawer(DRAWER_NAME)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const input: CreateBlockInput = {
        name: formData.name,
        variety: formData.variety || undefined,
        plantingYear: formData.plantingYear || undefined,
        rowSpacing: formData.rowSpacing ? Number(formData.rowSpacing) : undefined,
        vineSpacing: formData.vineSpacing ? Number(formData.vineSpacing) : undefined,
        geometry: drawnGeometry,
        customFields: customFields.length > 0 ? customFields : undefined,
      }

      if (isEditMode && editingBlockId) {
        // Update existing block
        await updateBlock(editingBlockId, input)
        showAlert('Block updated successfully', 'success')
      } else {
        // Create new block
        await createBlock(input)
        showAlert('Block created successfully', 'success')
      }
      
      clearDrawing()
      setDrawMode('simple_select')
      setDrawnGeometry(null)
      
      // Refresh the blocks list
      if (refetch) {
        await refetch()
      }
      setFormData({
        name: '',
        variety: '',
        plantingYear: new Date().getFullYear(),
        rowSpacing: '',
        vineSpacing: '',
      })
      setCustomFields([])
      setIsEditMode(false)
      setEditingBlockId(null)
      closeDrawer(DRAWER_NAME)
    } catch (error: any) {
      showAlert(error.message || `Failed to ${isEditMode ? 'update' : 'create'} block`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      {
        key: `field_${Date.now()}`,
        label: '',
        value: '',
        dataType: 'string',
      },
    ])
  }

  const updateCustomField = (index: number, updates: Partial<BlockField>) => {
    const updated = [...customFields]
    updated[index] = { ...updated[index], ...updates }
    setCustomFields(updated)
  }

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index))
  }

  return (
    <Drawer 
      isOpen={drawers[DRAWER_NAME] || false} 
      title={isEditMode ? "Edit Block" : "Create New Block"}
      onClose={cancelDrawing}
      position="left"
    >
      <div className="space-y-6">
        {!drawnGeometry ? (
          // No geometry yet
          <div className="text-center py-8">
            <p className="text-gray-500">No polygon drawn yet. Use the toolbar on the right to draw a block.</p>
          </div>
        ) : (
          // Show form to fill in details
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Block Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                required
                placeholder="e.g., Block A"
              />
            </div>

            {/* Variety */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variety
              </label>
              <input
                type="text"
                value={formData.variety}
                onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                className="input"
                placeholder="e.g., Cabernet Sauvignon"
              />
            </div>

            {/* Planting Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Planting Year
              </label>
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

            {/* Spacing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Row Spacing (m)
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vine Spacing (m)
                </label>
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

            {/* Custom Fields */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Fields (Optional)
                </label>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="btn btn-sm btn-secondary flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add
                </button>
              </div>

              {customFields.length > 0 && (
                <div className="space-y-3">
                  {customFields.map((field, index) => (
                    <div
                      key={field.key}
                      className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            updateCustomField(index, { label: e.target.value })
                          }
                          placeholder="Field name"
                          className="input input-sm"
                        />
                        <input
                          type={field.dataType === 'number' ? 'number' : 'text'}
                          value={String(field.value)}
                          onChange={(e) =>
                            updateCustomField(index, { value: e.target.value })
                          }
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
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  if (draw) {
                    draw.deleteAll()
                  }
                  setDrawnGeometry(null)
                  clearDrawing()
                  closeDrawer(DRAWER_NAME)
                }}
                className="btn btn-secondary"
                disabled={loading}
              >
                Redraw
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={loading}
              >
                {loading 
                  ? (isEditMode ? 'Updating...' : 'Creating...') 
                  : (isEditMode ? 'Update Block' : 'Create Block')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Drawer>
  )
}
