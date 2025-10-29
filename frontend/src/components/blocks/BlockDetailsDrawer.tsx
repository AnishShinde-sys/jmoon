import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useUI } from '@/context/UIContext'
import { Block } from '@/types/block'
import Drawer from '../ui/Drawer'
import apiClient from '@/lib/apiClient'
import { 
  PencilIcon,
  TrashIcon,
  MapIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'

const DRAWER_NAME = 'blockDetails'

export default function BlockDetailsDrawer() {
  const { farmId } = useParams<{ farmId: string }>()
  const { drawers, closeDrawer, showAlert } = useUI()
  const [block, setBlock] = useState<Block | null>(null)
  const [loading, setLoading] = useState(false)

  // Get block ID from drawer state
  const blockId = drawers[DRAWER_NAME] as string | undefined

  useEffect(() => {
    if (blockId && blockId !== 'true') {
      loadBlockDetails(blockId)
    }
  }, [blockId, farmId])

  const loadBlockDetails = async (id: string) => {
    if (!farmId) return
    setLoading(true)
    try {
      const response = await apiClient.get(`/api/farms/${farmId}/blocks/${id}`)
      // Backend returns GeoJSON Feature, extract properties for Block type
      const blockData = response.data.properties || response.data
      setBlock(blockData)
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to load block details', 'error')
      closeDrawer(DRAWER_NAME)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    if (!block || !blockId) return
    // Close block details and open create block drawer in edit mode
    closeDrawer(DRAWER_NAME)
    setTimeout(() => {
      // Store the block data for editing
      // This will be picked up by CreateBlockDrawer
      const editData = { blockId, block }
      sessionStorage.setItem('editBlockData', JSON.stringify(editData))
      // Trigger a custom event to open create block drawer with edit data
      window.dispatchEvent(new CustomEvent('editBlock', { detail: { blockId, block } }))
    }, 100)
  }

  const handleDelete = async () => {
    if (!block || !blockId) return
    if (!confirm(`Are you sure you want to delete "${block.name}"?`)) return

    try {
      await apiClient.delete(`/api/farms/${farmId}/blocks/${blockId}`)
      showAlert('Block deleted successfully', 'success')
      closeDrawer(DRAWER_NAME)
      // Reload the page to update the blocks list
      window.location.reload()
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to delete block', 'error')
    }
  }

  if (!block && !loading) {
    return null
  }

  return (
    <Drawer 
      isOpen={!!blockId} 
      title={block?.name || 'Block Details'}
      onClose={() => closeDrawer(DRAWER_NAME)} 
      position="right"
      showBackdrop={false}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : block ? (
        <div className="space-y-4">
          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Description</label>
            <p className="text-sm text-gray-700 mt-1">
              {block.variety || 'No variety specified'}
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {block.variety && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Variety</label>
                <p className="text-sm font-medium mt-1">{block.variety}</p>
              </div>
            )}
            {block.plantingYear && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Planting Year</label>
                <p className="text-sm font-medium mt-1">{block.plantingYear}</p>
              </div>
            )}
            {block.rowSpacing && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Row Spacing</label>
                <p className="text-sm font-medium mt-1">{block.rowSpacing}m</p>
              </div>
            )}
            {block.vineSpacing && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Vine Spacing</label>
                <p className="text-sm font-medium mt-1">{block.vineSpacing}m</p>
              </div>
            )}
          </div>

          {/* Area */}
          <div className="border-t pt-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Area</label>
            <p className="text-2xl font-bold mt-1">
              {block.area ? `${(block.area / 10000).toFixed(2)} ha` : 'N/A'}
            </p>
          </div>

          {/* Custom Fields */}
          {block.customFields && block.customFields.length > 0 && (
            <div className="border-t pt-4">
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Custom Fields</label>
              <div className="space-y-2">
                {block.customFields.map((field) => (
                  <div key={field.key} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">{field.label}</span>
                    <span className="text-sm font-medium">{String(field.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="border-t pt-4 space-y-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              <span>Created: {new Date(block.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              <span>Updated: {new Date(block.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t pt-4 flex gap-2">
            <button
              onClick={handleEdit}
              className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
            >
              <PencilIcon className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 btn bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </Drawer>
  )
}


