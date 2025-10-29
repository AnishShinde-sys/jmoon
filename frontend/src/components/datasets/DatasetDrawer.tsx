import { useState } from 'react'
import { useParams } from 'react-router-dom'
import apiClient from '@/lib/apiClient'
import { useUI } from '@/context/UIContext'
import { Dataset } from '@/types/dataset'
import Drawer from '../ui/Drawer'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'

const DRAWER_NAME = 'datasets'

export default function DatasetDrawer() {
  const { farmId } = useParams<{ farmId: string }>()
  const { drawers, closeDrawer } = useUI()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(false)

  const loadDatasets = async () => {
    if (!farmId) return
    setLoading(true)
    try {
      const response = await apiClient.get(`/api/farms/${farmId}/datasets`)
      setDatasets(response.data || [])
    } catch (error) {
      console.error('Failed to load datasets:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load datasets when drawer opens
  if (drawers[DRAWER_NAME] && datasets.length === 0 && !loading) {
    loadDatasets()
  }

  const handleUpload = () => {
    // TODO: Implement dataset upload
    console.log('Upload dataset')
  }

  return (
    <Drawer 
      isOpen={drawers[DRAWER_NAME] || false} 
      title="Datasets" 
      onClose={() => closeDrawer(DRAWER_NAME)} 
      position="left"
      showBackdrop={false}
    >
      <div className="space-y-4">
        {/* Upload Button */}
        <button
          onClick={handleUpload}
          className="w-full btn btn-primary flex items-center justify-center gap-2"
        >
          <CloudArrowUpIcon className="w-5 h-5" />
          Upload Dataset
        </button>

        {/* Dataset List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="spinner mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading datasets...</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No datasets yet</p>
            <p className="text-xs text-gray-400 mt-1">Upload your first dataset to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {datasets.map((dataset) => (
              <div
                key={dataset.id}
                className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <p className="font-medium text-sm">{dataset.name}</p>
                {dataset.description && (
                  <p className="text-xs text-gray-500 mt-1">{dataset.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {dataset.recordCount || 0} records
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  )
}





