import { useState } from 'react'
import { Block, BlockField } from '../../types/block'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface BlockEditorProps {
  block: Block
  onSave: (updates: Partial<Block>) => Promise<void>
  onCancel: () => void
}

export default function BlockEditor({ block, onSave, onCancel }: BlockEditorProps) {
  const [formData, setFormData] = useState({
    name: block.name || '',
    variety: block.variety || '',
    plantingYear: block.plantingYear || new Date().getFullYear(),
    rowSpacing: block.rowSpacing || '',
    vineSpacing: block.vineSpacing || '',
  })
  const [customFields, setCustomFields] = useState<BlockField[]>(block.customFields || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const updates: Partial<Block> = {
        name: formData.name,
        variety: formData.variety || undefined,
        plantingYear: formData.plantingYear || undefined,
        rowSpacing: formData.rowSpacing ? Number(formData.rowSpacing) : undefined,
        vineSpacing: formData.vineSpacing ? Number(formData.vineSpacing) : undefined,
        customFields: customFields.length > 0 ? customFields : undefined,
      }

      await onSave(updates)
    } catch (err: any) {
      setError(err.message || 'Failed to update block')
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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Edit Block</h3>
        <p className="text-sm text-gray-600 mt-1">
          Update block properties and metadata
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

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
            onChange={(e) => setFormData({ ...formData, plantingYear: Number(e.target.value) })}
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
              onChange={(e) => setFormData({ ...formData, rowSpacing: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, vineSpacing: e.target.value })}
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
              Custom Fields
            </label>
            <button
              type="button"
              onClick={addCustomField}
              className="btn btn-sm btn-secondary flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add Field
            </button>
          </div>

          {customFields.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No custom fields. Click "Add Field" to create one.
            </p>
          ) : (
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
        <div className="flex items-center gap-3 justify-end pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
