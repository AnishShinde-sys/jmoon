'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AdjustmentsHorizontalIcon,
  BellIcon,
  ChevronRightIcon,
  MegaphoneIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import bbox from '@turf/bbox'

import CreateBlockDrawer from '@/components/blocks/CreateBlockDrawer'
import BlockDetailsDrawer from '@/components/blocks/BlockDetailsDrawer'
import BlockRevisionsDrawer from '@/components/blocks/BlockRevisionsDrawer'
import BlockRevisionPreviewDrawer from '@/components/blocks/BlockRevisionPreviewDrawer'
import DatasetDrawer from '@/components/datasets/DatasetDrawer'
import DatasetDetailsDrawer from '@/components/datasets/DatasetDetailsDrawer'
import CopyDatasetDrawer from '@/components/datasets/CopyDatasetDrawer'
import DatasetRevisionsDrawer from '@/components/datasets/DatasetRevisionsDrawer'
import PluginsDrawer from '@/components/plugins/PluginsDrawer'
import CollectorPreviewDrawer from '@/components/collector/CollectorPreviewDrawer'
import CollectorsDrawer from '@/components/collector/CollectorsDrawer'
import CreateCollectorModal from '@/components/collector/CreateCollectorModal'
import CollectorFormDrawer from '@/components/collector/CollectorFormDrawer'
import DataPointDetailsDrawer from '@/components/collector/DataPointDetailsDrawer'
import { Collector } from '@/types/collector'
import CollaboratorsDrawer from '@/components/farm/CollaboratorsDrawer'
import FarmDetailsDrawer from '@/components/farm/FarmDetailsDrawer'
import FarmSettingsDrawer from '@/components/farm/FarmSettingsDrawer'
import FarmSidebar from '@/components/farm/FarmSidebar'
import DrawingToolbar from '@/components/map/DrawingToolbar'
import MapContainer from '@/components/map/MapContainer'
import MapLayersDrawer from '@/components/map/MapLayersDrawer'
import MapLegend from '@/components/map/MapLegend'
import TerrainToggle from '@/components/map/TerrainToggle'
import { useUI } from '@/context/UIContext'
import { useMapContext } from '@/context/MapContext'
import { useBlocks } from '@/hooks/useBlocks'
import apiClient from '@/lib/apiClient'
import { Farm } from '@/types/farm'

interface FarmPageClientProps {
  farmId: string
  layerType?: string
  layerId?: string
}

export function FarmPageClient({ farmId, layerType, layerId }: FarmPageClientProps) {
  const router = useRouter()
  const { showAlert, openDrawer, closeDrawer, drawers, openModal } = useUI()
  const { map, draw } = useMapContext()
  const { blocksGeoJSON: blocksJSONFromHook } = useBlocks(farmId)

  const [blocksGeoJSON, setBlocksGeoJSON] = useState<any[]>([])
  const [farm, setFarm] = useState<Farm | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  // Fetch farm details
  useEffect(() => {
    const loadFarm = async () => {
      try {
        const response = await apiClient.get(`/api/farms/${farmId}`)
        const farmData = response.data

        if (!farmData.vizSettings) {
          farmData.vizSettings = {
            colorOpacity: 0.8,
            colorBy: 'solid',
            blockColor: '#6e59c7',
            labelBy: 'noLabel',
          }
        }

        setFarm(farmData)
      } catch (error: any) {
        showAlert(error?.response?.data?.message || 'Failed to load farm', 'error')
        router.replace('/dashboard')
      }
    }

    if (farmId) {
      loadFarm()
    }
  }, [farmId, router, showAlert])

  // Sync blocks from hook
  useEffect(() => {
    if (blocksJSONFromHook?.features) {
      setBlocksGeoJSON(blocksJSONFromHook.features)
    } else {
      setBlocksGeoJSON([])
    }
  }, [blocksJSONFromHook])

  // Listen for drawing events
  useEffect(() => {
    if (!map || !draw) return

    const handleDrawCreate = () => {
      const features = draw.getAll()
      if (features.features.length > 0) {
        setHasDrawing(true)
        setIsDrawing(false)
        closeDrawer('createBlock')
        setTimeout(() => {
          openDrawer('createBlock')
        }, 100)
      }
    }

    const handleDrawDelete = () => {
      const features = draw.getAll()
      setHasDrawing(features.features.length > 0)
    }

    map.on('draw.create', handleDrawCreate)
    map.on('draw.delete', handleDrawDelete)

    return () => {
      map.off('draw.create', handleDrawCreate)
      map.off('draw.delete', handleDrawDelete)
    }
  }, [map, draw, openDrawer, closeDrawer])

  useEffect(() => {
    const handleLaunchCollector = (event: Event) => {
      const detail = (event as CustomEvent<{ collector: Collector; dataset?: { id: string; name: string } }>).detail
      if (!detail?.collector) {
        showAlert('Collector payload missing.', 'error')
        return
      }

      openDrawer('collector', {
        collector: detail.collector,
        farmId,
        dataset: detail.dataset,
      })
      showAlert(`Collecting data with “${detail.collector.name}”.`, 'success')
    }

    window.addEventListener('launchCollector', handleLaunchCollector as EventListener)
    return () => {
      window.removeEventListener('launchCollector', handleLaunchCollector as EventListener)
    }
  }, [farmId, openDrawer, showAlert])

  // Handle dataset routes to auto-launch shared datasets
  useEffect(() => {
    if (layerType !== 'dataset' || !layerId || !farmId) {
      return
    }

    let cancelled = false

    const launchFromRoute = async () => {
      try {
        const response = await apiClient.get(`/api/datasets/${layerId}`, {
          params: { farmId },
        })

        if (cancelled) return

        const dataset = response.data

        window.dispatchEvent(
          new CustomEvent('clearDatasetLayers', {
            detail: { datasetId: dataset.id },
          })
        )

        window.dispatchEvent(
          new CustomEvent('launchDataset', {
            detail: {
              dataset,
              options: {
                autoZoom: true,
                clearExistingLayers: true,
                openDetails: true,
              },
            },
          })
        )

        openDrawer('datasetDetails', dataset)
        showAlert(`Launching “${dataset.name}” on the map.`, 'success')
      } catch (error: any) {
        if (!cancelled) {
          console.error('Failed to launch dataset from route:', error)
          showAlert(error?.response?.data?.message || 'Failed to load dataset from link', 'error')
        }
      }
    }

    launchFromRoute()

    return () => {
      cancelled = true
    }
  }, [layerType, layerId, farmId, openDrawer, showAlert])

  const startDrawing = () => {
    if (!draw) return
    setIsDrawing(true)
    draw.changeMode('draw_polygon')
    showAlert('Click to start drawing a polygon. Double-click to finish.', 'info')
  }

  const clearDrawing = () => {
    if (!draw) return
    draw.deleteAll()
    setIsDrawing(false)
    setHasDrawing(false)
  }

  const finishDrawing = () => {
    if (!draw) return
    setIsDrawing(false)
    draw.changeMode('simple_select')
  }

  const handleBlockClick = (blockId: string) => {
    setSelectedBlockId(blockId)
    closeDrawer('farmDetails')
    setTimeout(() => {
      openDrawer('blockDetails', blockId)
    }, 100)

    if (map && blocksGeoJSON.length > 0) {
      const blockFeature = blocksGeoJSON.find((b: any) => {
        const id = b.id || b.properties?.id
        return id === blockId
      })

      if (blockFeature?.geometry) {
        try {
          const bounds = bbox(blockFeature as any)
          map.fitBounds(bounds as [number, number, number, number], { padding: 100, duration: 1000 })
        } catch (error) {
          console.error('Error flying to block:', error)
        }
      }
    }
  }

  const handleCreateBlock = () => {
    startDrawing()
  }

  const handleShowSettings = () => {
    if (!farm) return
    openDrawer('farmSettings')
  }

  const handleFarmUpdate = async (updatedFarm: Farm) => {
    try {
      const response = await apiClient.put(`/api/farms/${farmId}`, {
        name: updatedFarm.name,
        description: updatedFarm.description,
      })
      setFarm(response.data)
      showAlert('Farm settings updated successfully', 'success')
      closeDrawer('farmSettings')
    } catch (error: any) {
      showAlert(error?.response?.data?.message || 'Failed to update farm settings', 'error')
    }
  }

  const handleShowCollaborators = () => {
    openDrawer('collaborators')
  }

  const handleVizUpdate = (settings: Farm['vizSettings']) => {
    if (!farm) return
    setFarm({ ...farm, vizSettings: settings })
  }

  const farmCenter = useMemo(() => {
    if (!farm?.geolocation) return undefined
    return [farm.geolocation.longitude, farm.geolocation.latitude] as [number, number]
  }, [farm])

  if (!farm) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex relative overflow-hidden">
      <CreateBlockDrawer farmId={farmId} />
      <BlockDetailsDrawer farmId={farmId} />
      <BlockRevisionsDrawer farmId={farmId} />
      <BlockRevisionPreviewDrawer />
      <DatasetDrawer farmId={farmId} />
      <DatasetDetailsDrawer />
      <CopyDatasetDrawer farmId={farmId} />
      <DatasetRevisionsDrawer />
      <MapLayersDrawer />
      <CollectorPreviewDrawer farmId={farmId} />
      <CollectorsDrawer farmId={farmId} farmOwnerId={farm?.owner || farm?.ownerId} />
      <CreateCollectorModal />
      <CollectorFormDrawer />
      <DataPointDetailsDrawer farmId={farmId} />
      <PluginsDrawer
        farmId={farmId}
        farmOwnerId={farm?.owner || farm?.ownerId}
        initialEnabled={farm?.plugins}
        onPluginsChange={(pluginIds) =>
          setFarm((prev) => (prev ? { ...prev, plugins: pluginIds } : prev))
        }
      />
      <FarmDetailsDrawer farmId={farmId} />
      <FarmSettingsDrawer
        isOpen={!!drawers.farmSettings}
        farm={farm}
        onClose={() => closeDrawer('farmSettings')}
        onUpdate={handleFarmUpdate}
      />
      <CollaboratorsDrawer
        isOpen={!!drawers.collaborators}
        farm={farm}
        onClose={() => closeDrawer('collaborators')}
      />

      <FarmSidebar
        farm={farm}
        blocks={blocksGeoJSON}
        onClose={() => setSidebarOpen(false)}
        onCreateBlock={handleCreateBlock}
        onShowSettings={handleShowSettings}
        onShowCollaborators={handleShowCollaborators}
        onBlockClick={handleBlockClick}
        onVizUpdate={handleVizUpdate}
        isOpen={sidebarOpen}
      />

      <div className={`absolute inset-0 transition-all duration-300 ${sidebarOpen ? 'pl-0' : 'pl-0'}`}>
        <MapContainer
          center={farmCenter}
          zoom={13}
          enableDrawing
          blocks={blocksGeoJSON}
          onBlockClick={handleBlockClick}
          vizSettings={farm.vizSettings}
          selectedBlockId={selectedBlockId}
        >
          <DrawingToolbar
            onStartDrawing={startDrawing}
            onClear={clearDrawing}
            onFinish={finishDrawing}
            isDrawing={isDrawing}
            hasDrawing={hasDrawing}
          />
        </MapContainer>

        <div className="absolute top-24 right-6 z-40 flex flex-col items-end gap-2">
          <TerrainToggle />
          <button
            onClick={() => openDrawer('mapLayers')}
            className="flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 shadow-md transition hover:bg-white"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" /> Layers &amp; Terrain
          </button>
          <button
            onClick={() => openDrawer('notifications')}
            className="flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 shadow-md transition hover:bg-white"
          >
            <BellIcon className="h-4 w-4" /> Notifications
          </button>
          <button
            onClick={() => openDrawer('userDetails')}
            className="flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 shadow-md transition hover:bg-white"
          >
            <UserCircleIcon className="h-4 w-4" /> Account
          </button>
          <button
            onClick={() => openModal('feedback')}
            className="flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 shadow-md transition hover:bg-white"
          >
            <MegaphoneIcon className="h-4 w-4" /> Feedback
          </button>
        </div>

        <div className="pointer-events-auto absolute bottom-6 left-6 z-40">
          <MapLegend />
        </div>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-40 transition-all"
            style={{
              width: '24px',
              height: '48px',
              backgroundColor: 'white',
              borderTopRightRadius: '24px',
              borderBottomRightRadius: '24px',
              border: '1px solid #e5e7eb',
              borderLeft: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronRightIcon className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>
    </div>
  )
}

