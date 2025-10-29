import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Farm } from '@/types/farm'
import { Cog6ToothIcon, UsersIcon, MapPinIcon, XMarkIcon, HomeIcon } from '@heroicons/react/24/outline'
import FarmVizSettings from './FarmVizSettings'

interface FarmSidebarProps {
  farm: Farm
  blocks: any[]
  onClose: () => void
  onCreateBlock: () => void
  onShowSettings: () => void
  onShowCollaborators: () => void
  onBlockClick?: (blockId: string) => void
  onVizUpdate?: (settings: Farm['vizSettings']) => void
  isOpen: boolean
}

export default function FarmSidebar({
  farm,
  blocks,
  onClose,
  onCreateBlock,
  onShowSettings,
  onShowCollaborators,
  onBlockClick,
  onVizUpdate,
  isOpen,
}: FarmSidebarProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'viz' | 'info' | 'list' | 'cloud' | 'file'>('viz')

  const handleBackToFarms = () => {
    navigate('/dashboard')
  }

  // Update visualization settings
  const handleVizUpdate = (settings: Farm['vizSettings']) => {
    if (onVizUpdate) {
      onVizUpdate(settings)
    }
  }

  // Download handlers
  const handleDownloadGeoJSON = () => {
    const geoJsonData = {
      type: 'FeatureCollection',
      features: blocks,
    }
    const dataStr = JSON.stringify(geoJsonData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${farm.name.replace(/\s+/g, '_')}.geojson`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadCSV = () => {
    const csvRows: string[] = []
    
    // Get all unique headers from all blocks
    const allHeaders = new Set<string>()
    blocks.forEach((block: any) => {
      if (block.properties) {
        Object.keys(block.properties).forEach(key => allHeaders.add(key))
      }
    })
    
    const headers = Array.from(allHeaders)
    
    // Create CSV header
    csvRows.push(headers.join(','))
    
    // Add data rows
    blocks.forEach((block: any) => {
      const values = headers.map(header => {
        const value = block.properties?.[header] || ''
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      csvRows.push(values.join(','))
    })
    
    const csvContent = csvRows.join('\n')
    const dataBlob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${farm.name.replace(/\s+/g, '_')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <aside className={`fixed left-0 top-0 bottom-0 w-80 bg-white shadow-xl z-30 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 truncate pr-2">{farm.name}</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBackToFarms}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Back to All Farms"
              >
                <HomeIcon className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={onShowSettings}
              className="flex-1 flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white px-1.5 py-1.5 rounded text-xs transition-colors"
              title="Settings"
            >
              <Cog6ToothIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onShowCollaborators}
              className="flex-1 flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white px-1.5 py-1.5 rounded text-xs transition-colors"
              title="Collaborators"
            >
              <UsersIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onCreateBlock}
              className="flex-1 flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white px-1.5 py-1.5 rounded text-xs transition-colors"
              title="Create Blocks"
            >
              <MapPinIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('viz')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'viz' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'info' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'list' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'cloud' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'file' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>

          {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-200px)] px-4 py-4">
          {activeTab === 'viz' && (
            <FarmVizSettings farm={farm} onUpdate={handleVizUpdate} />
          )}
          {activeTab === 'info' && (
            <div className="py-4">
              <h3 className="font-semibold mb-2">Farm Information</h3>
              <p className="text-sm text-gray-600">Farm ID: {farm.id}</p>
              {farm.description && (
                <p className="text-sm text-gray-600 mt-2">{farm.description}</p>
              )}
            </div>
          )}
          {activeTab === 'list' && (
            <div className="py-4">
              {blocks.length === 0 ? (
                <p className="text-sm text-gray-500">No blocks yet. Use "Create Blocks" to add your first block.</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {blocks.map((block: any) => {
                    const blockId = block.id || block.properties?.id
                    return (
                      <div
                        key={blockId}
                        onClick={() => onBlockClick?.(blockId)}
                        className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition-all"
                      >
                        <p className="font-medium text-sm mb-2">
                          {block.properties?.name || 'Unnamed Block'}
                        </p>
                        
                        {/* Show all properties */}
                        <div className="space-y-1">
                          {block.properties?.area && (
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-600">Area:</span>
                              <span className="text-xs text-gray-900">
                                {(block.properties.area / 10000).toFixed(2)} ha
                              </span>
                            </div>
                          )}
                          {block.properties?.variety && (
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-600">Variety:</span>
                              <span className="text-xs text-gray-900">{block.properties.variety}</span>
                            </div>
                          )}
                          {block.properties?.plantingYear && (
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-600">Year:</span>
                              <span className="text-xs text-gray-900">{block.properties.plantingYear}</span>
                            </div>
                          )}
                          {block.properties?.description && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {block.properties.description}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {activeTab === 'cloud' && (
            <div className="py-4 space-y-3">
              <h3 className="font-semibold mb-3">Downloads</h3>
              <button
                onClick={handleDownloadGeoJSON}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download GeoJSON
              </button>
              <button
                onClick={handleDownloadCSV}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV
              </button>
              <button
                onClick={handlePrint}
                className="w-full btn btn-secondary flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Map
              </button>
            </div>
          )}
          {activeTab === 'file' && (
            <div className="py-4">
              <p className="text-sm text-gray-500">Import functionality will be shown here</p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

