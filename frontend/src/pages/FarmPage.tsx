import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUI } from '@/context/UIContext'
import { Farm } from '@/types/farm'
import { Dataset } from '@/types/dataset'
import { Block } from '@/types/block'
import apiClient from '@/lib/apiClient'

export default function FarmPage() {
  const { farmId, layerType, layerId } = useParams<{
    farmId: string
    layerType?: string
    layerId?: string
  }>()
  const navigate = useNavigate()
  const { showAlert } = useUI()

  const [farm, setFarm] = useState<Farm | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (farmId) {
      loadFarm()
      loadDatasets()
      loadBlocks()
    }
  }, [farmId])

  const loadFarm = async () => {
    try {
      const response = await apiClient.get(`/api/farms/${farmId}`)
      setFarm(response.data)
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to load farm', 'error')
      navigate('/dashboard')
    }
  }

  const loadDatasets = async () => {
    try {
      const response = await apiClient.get(`/api/farms/${farmId}/datasets`)
      setDatasets(response.data)
    } catch (error) {
      console.error('Failed to load datasets:', error)
    }
  }

  const loadBlocks = async () => {
    try {
      const response = await apiClient.get(`/api/farms/${farmId}/blocks`)
      setBlocks(response.data.features || [])
    } catch (error) {
      console.error('Failed to load blocks:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{farm?.name}</h1>
              {farm?.description && <p className="text-sm text-gray-600">{farm.description}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary">Datasets</button>
            <button className="btn btn-secondary">Blocks</button>
            <button className="btn btn-secondary">Collectors</button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Datasets</h2>
            {datasets.length === 0 ? (
              <p className="text-sm text-gray-500">No datasets yet</p>
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
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-lg font-semibold mt-6 mb-4">Blocks</h2>
            {blocks.length === 0 ? (
              <p className="text-sm text-gray-500">No blocks yet</p>
            ) : (
              <div className="space-y-2">
                {blocks.slice(0, 10).map((block: any, index) => (
                  <div
                    key={block.properties?.blockId || index}
                    className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <p className="font-medium text-sm">{block.properties?.name || 'Unnamed Block'}</p>
                    {block.properties?.hectares && (
                      <p className="text-xs text-gray-500 mt-1">
                        {block.properties.hectares} ha
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Map Area */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Map will be rendered here</p>
              <p className="text-sm">Using Mapbox GL JS + Turf.js</p>
              <p className="text-xs mt-4">
                Farm ID: {farmId}
                {layerType && ` | Layer: ${layerType}/${layerId}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
