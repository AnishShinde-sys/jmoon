"use client"

import { useState, useMemo, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Farm } from '@/types/farm'
import {
  Cog6ToothIcon,
  UsersIcon,
  CubeIcon,
  XMarkIcon,
  HomeIcon,
  FolderIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import FarmVizSettings from './FarmVizSettings'
import { useDatasets } from '@/hooks/useDatasets'
import apiClient from '@/lib/apiClient'
import type { Dataset } from '@/types/dataset'
import type { Collector } from '@/types/collector'
import type { PluginDefinition } from '@/types/plugin'
import { useUserProfile } from '@/context/UserProfileContext'
import { formatArea } from '@/lib/utils'
import { useUI } from '@/context/UIContext'
import type { BlockField, CreateBlockInput, UpdateBlockInput } from '@/types/block'
import BlockEditorPanel, { BlockEditorState } from '@/components/blocks/BlockEditorPanel'

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
  onOpenBlockDrawer?: () => void
  selectedBlockId?: string | null
  blockEditorState: BlockEditorState
  onBlockEditorStateChange: (state: BlockEditorState) => void
  createBlock: (input: CreateBlockInput) => Promise<any>
  updateBlock: (blockId: string, input: UpdateBlockInput & { revisionMessage?: string }) => Promise<any>
  deleteBlock: (blockId: string) => Promise<void>
  refetchBlocks?: () => Promise<void>
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
  onOpenBlockDrawer,
  selectedBlockId,
  blockEditorState,
  onBlockEditorStateChange,
  createBlock,
  updateBlock,
  deleteBlock,
  refetchBlocks,
}: FarmSidebarProps) {
  const router = useRouter()
  const { profile } = useUserProfile()
  const [activeTab, setActiveTab] = useState<'viz' | 'list' | 'cloud' | 'datasets' | 'collectors' | 'plugins'>(
    'list'
  )

  const farmPluginIds = useMemo(() => farm.plugins ?? [], [farm.plugins])
  const measurementSystem = profile?.measurementSystem ?? 'Metric'

  const handleBackToFarms = () => {
    router.push('/dashboard')
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

  const handleCreateBlockClick = () => {
    setActiveTab('list')
    onCreateBlock()
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <aside
        className={`fixed left-0 top-0 bottom-0 w-80 bg-white shadow-xl z-30 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
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

        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('viz')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'viz' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Visualization"
            aria-label="Visualization"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'list' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Block List"
            aria-label="Block List"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('datasets')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'datasets' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Datasets"
            aria-label="Datasets"
          >
            <FolderIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('collectors')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'collectors' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Data Collectors"
            aria-label="Data Collectors"
          >
            <ClipboardDocumentListIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'cloud' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Exports"
            aria-label="Exports"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('plugins')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${
              activeTab === 'plugins' ? 'bg-white border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Plugins"
            aria-label="Plugins"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
          </button>
          <button
            onClick={onOpenBlockDrawer}
            className="px-4 flex items-center justify-center text-gray-600 transition-colors hover:text-gray-900"
            title="Open Block Editor"
            aria-label="Open Block Editor"
            type="button"
          >
            <PencilSquareIcon className="w-5 h-5" />
          </button>
        </div>

          {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === 'viz' && (
            <FarmVizSettings farm={farm} onUpdate={handleVizUpdate} />
          )}
          {activeTab === 'list' && (
            <div className="space-y-4 py-4">
              <button
                type="button"
                onClick={onOpenBlockDrawer}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <PencilSquareIcon className="h-4 w-4" />
                Edit Blocks
              </button>

              <BlockEditorPanel
                farmId={farm.id}
                state={blockEditorState}
                createBlock={createBlock}
                updateBlock={updateBlock}
                deleteBlock={deleteBlock}
                refetchBlocks={refetchBlocks}
                onRequestClose={() => onBlockEditorStateChange({ mode: 'hidden' })}
              />

              {blocks.length === 0 ? (
                <p className="text-sm text-gray-500">No blocks yet. Use "Create Blocks" to add your first block.</p>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto">
                  {blocks.map((block: any) => {
                    const blockId = block.id || block.properties?.id
                    const isSelected = selectedBlockId && String(blockId) === String(selectedBlockId)
                    return (
                      <div
                        key={blockId}
                        onClick={() => onBlockClick?.(blockId)}
                        className={`cursor-pointer rounded-md border p-3 transition-all ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        title={block.properties?.description || block.properties?.name || 'Block details'}
                      >
                        <p className="mb-2 text-sm font-medium">
                          {block.properties?.name || 'Unnamed Block'}
                        </p>
                        <div className="space-y-1 text-xs">
                          {block.properties?.area != null && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Area:</span>
                              <span className="text-gray-900">{formatArea(block.properties.area, measurementSystem)}</span>
                            </div>
                          )}
                          {block.properties?.variety && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Variety:</span>
                              <span className="text-gray-900">{block.properties.variety}</span>
                            </div>
                          )}
                          {block.properties?.plantingYear && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Year:</span>
                              <span className="text-gray-900">{block.properties.plantingYear}</span>
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
          {activeTab === 'datasets' && farm.id && <DatasetsTabContent farmId={farm.id} />}
          {activeTab === 'collectors' && farm.id && <CollectorsTabContent farmId={farm.id} />}
          {activeTab === 'plugins' && farm.id && (
            <PluginsTabContent farmId={farm.id} enabledPluginIds={farmPluginIds} />
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
        </div>

        <div className="px-4 pb-4 pt-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onShowSettings}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                title="Settings"
              >
                <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
                Settings
              </button>
              <button
                onClick={onShowCollaborators}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                title="Collaborators"
              >
                <UsersIcon className="w-4 h-4 text-gray-500" />
                Collaborators
              </button>
            </div>
            <button
              onClick={handleCreateBlockClick}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-yellow-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-yellow-600"
              title="Create Blocks"
            >
              <CubeIcon className="w-5 h-5" />
              Create Blocks
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function DatasetsTabContent({ farmId }: { farmId: string }) {
  const { datasets, loading, error } = useDatasets(farmId)
  const { openDrawer } = useUI()

  const handleDatasetSelect = (dataset: Dataset) => {
    openDrawer('datasetDetails', dataset)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner" aria-label="Loading datasets" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!datasets.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500">No datasets yet for this farm.</p>
        <p className="mt-1 text-xs text-gray-400">Upload a dataset to see it listed here.</p>
      </div>
    )
  }

  return (
    <div className="py-4 space-y-3">
      <h3 className="font-semibold text-sm text-gray-800">Datasets</h3>
      <ul className="space-y-2">
        {datasets.map((dataset: Dataset) => (
          <li
            key={dataset.id}
            className="rounded-md border border-gray-200 bg-white p-3 shadow-sm cursor-pointer transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2"
            title={`${dataset.name}${dataset.description ? ' - ' + dataset.description : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => handleDatasetSelect(dataset)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleDatasetSelect(dataset)
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{dataset.name}</p>
                {dataset.description && (
                  <p
                    className="mt-1 text-xs text-gray-500"
                    style={{ WebkitMaskImage: 'none', maskImage: 'none' }}
                  >
                    {dataset.description}
                  </p>
                )}
              </div>
              {typeof dataset.recordCount === 'number' && (
                <span className="text-[11px] uppercase tracking-wide text-gray-400">
                  {dataset.recordCount} records
                </span>
              )}
            </div>
            {dataset.processing?.status && dataset.processing.status !== 'completed' && (
              <p className="mt-2 text-xs text-amber-600">
                Status: {dataset.processing.status}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CollectorsTabContent({ farmId }: { farmId: string }) {
  const [collectors, setCollectors] = useState<Collector[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchCollectors = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await apiClient.get<Collector[]>(`/api/farms/${farmId}/collectors`)
        if (!isMounted) return
        setCollectors(response.data || [])
      } catch (err: any) {
        if (!isMounted) return
        const message = err?.response?.data?.message || 'Failed to load collectors'
        setError(message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchCollectors()

    return () => {
      isMounted = false
    }
  }, [farmId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner" aria-label="Loading data collectors" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!collectors.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500">No data collectors have been created yet.</p>
        <p className="mt-1 text-xs text-gray-400">Create a collector to power field data capture.</p>
      </div>
    )
  }

  return (
    <div className="py-4 space-y-3">
      <h3 className="font-semibold text-sm text-gray-800">Data Collectors</h3>
      <ul className="space-y-2">
        {collectors.map((collector) => (
          <li
            key={collector.id}
            className="rounded-md border border-gray-200 bg-white p-3 shadow-sm"
            title={`${collector.name}${collector.description ? ' - ' + collector.description : ''}`}
          >
            <p className="text-sm font-medium text-gray-900">{collector.name}</p>
            {collector.description && (
              <p
                className="mt-1 text-xs text-gray-500"
                style={{ WebkitMaskImage: 'none', maskImage: 'none' }}
              >
                {collector.description}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-400">
              {collector.fields.length} field{collector.fields.length === 1 ? '' : 's'} defined
            </p>
            {collector.reCompile && (
              <p className="mt-2 inline-flex rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Needs rebuild
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function PluginsTabContent({ farmId, enabledPluginIds }: { farmId: string; enabledPluginIds: string[] }) {
  const [plugins, setPlugins] = useState<PluginDefinition[]>([])
  const [enabled, setEnabled] = useState<Set<string>>(new Set(enabledPluginIds))
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchPlugins = async () => {
      try {
        setLoading(true)
        setError(null)
        const [directoryRes, enabledRes] = await Promise.all([
          apiClient.get<PluginDefinition[]>('/api/plugins'),
          apiClient.get<{ enabled: string[] }>(`/api/farms/${farmId}/plugins`),
        ])

        if (!isMounted) return

        setPlugins(directoryRes.data || [])
        setEnabled(new Set(enabledRes.data?.enabled || enabledPluginIds))
      } catch (err: any) {
        if (!isMounted) return
        const message = err?.response?.data?.message || 'Failed to load plugins'
        setError(message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchPlugins()

    return () => {
      isMounted = false
    }
  }, [farmId, enabledPluginIds])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner" aria-label="Loading plugins" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!plugins.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500">No plugins are available right now.</p>
        <p className="mt-1 text-xs text-gray-400">Check back later for new integrations.</p>
      </div>
    )
  }

  return (
    <div className="py-4 space-y-3">
      <h3 className="font-semibold text-sm text-gray-800">Plugins</h3>
      <ul className="space-y-2">
        {plugins
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((plugin) => {
            const isEnabled = enabled.has(plugin.id)

            return (
              <li
                key={plugin.id}
                className="rounded-md border border-gray-200 bg-white p-3 shadow-sm"
                title={`${plugin.name}${plugin.description ? ' - ' + plugin.description : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{plugin.name}</p>
                    <p
                      className="mt-1 text-xs text-gray-500"
                      style={{ WebkitMaskImage: 'none', maskImage: 'none' }}
                    >
                      {plugin.description}
                    </p>
                  </div>
                  {isEnabled && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                      Active
                    </span>
                  )}
                </div>
              </li>
            )
          })}
      </ul>
    </div>
  )
}

