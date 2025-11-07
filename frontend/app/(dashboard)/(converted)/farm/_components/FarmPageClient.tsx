'use client'

import type mapboxgl from 'mapbox-gl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdjustmentsHorizontalIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import bbox from '@turf/bbox'

import BlockDetailsDrawer from '@/components/blocks/BlockDetailsDrawer'
import BlockRevisionPreviewDrawer from '@/components/blocks/BlockRevisionPreviewDrawer'
import BlockRevisionsDrawer from '@/components/blocks/BlockRevisionsDrawer'
import CreateBlockDrawer from '@/components/blocks/CreateBlockDrawer'
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
import MapContainer from '@/components/map/MapContainer'
import MapLayersDrawer from '@/components/map/MapLayersDrawer'
import MapLegend from '@/components/map/MapLegend'
import { useUI } from '@/context/UIContext'
import { useMapContext } from '@/context/MapContext'
import { useUserProfile } from '@/context/UserProfileContext'
import { useBlocks } from '@/hooks/useBlocks'
import apiClient from '@/lib/apiClient'
import { Block, BlockFieldDefinition } from '@/types/block'
import { Farm } from '@/types/farm'

const BLOCK_EDITING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_BLOCK_EDITING === 'true'

interface FarmPageClientProps {
  farmId: string
  layerType?: string
  layerId?: string
}

export function FarmPageClient({ farmId, layerType, layerId }: FarmPageClientProps) {
  const router = useRouter()
  const { showAlert, openDrawer, closeDrawer, drawers } = useUI()
  const { map } = useMapContext()
  const { profile } = useUserProfile()
  const blockEditingEnabled = BLOCK_EDITING_ENABLED
  const {
    blocks,
    blocksGeoJSON: blocksCollection,
    loading: blocksLoading,
    refetch: refetchBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
  } = useBlocks(farmId)

  const [blockFeatures, setBlockFeatures] = useState<GeoJSON.Feature[]>([])
  const [farm, setFarm] = useState<Farm | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [blockDrawerOpen, setBlockDrawerOpen] = useState(false)
  const [blockDrawerMode, setBlockDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingBlock, setEditingBlock] = useState<Block | null>(null)
  const [editingFeature, setEditingFeature] = useState<GeoJSON.Feature | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsBlock, setDetailsBlock] = useState<Block | null>(null)
  const [detailsFeature, setDetailsFeature] = useState<GeoJSON.Feature | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [drawingMode, setDrawingMode] = useState<'none' | 'create' | 'edit'>('none')

  const measurementSystem = profile?.measurementSystem || 'Metric'

  const emitBlocksRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent('blocks:refresh', { detail: { farmId } }))
  }, [farmId])

  const closeBlockDrawer = useCallback(() => {
    setBlockDrawerOpen(false)
    setDrawingMode('none')
    setEditingBlock(null)
    setEditingFeature(null)
  }, [])

  useEffect(() => {
    if (blocksCollection?.features) {
      setBlockFeatures(blocksCollection.features as GeoJSON.Feature[])
    } else {
      setBlockFeatures([])
    }
  }, [blocksCollection])

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

  useEffect(() => {
    const handleBlocksRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ farmId?: string }>).detail
      if (detail?.farmId && detail.farmId !== farmId) {
        return
      }
      refetchBlocks()
    }

    window.addEventListener('blocks:refresh', handleBlocksRefresh as EventListener)
    return () => {
      window.removeEventListener('blocks:refresh', handleBlocksRefresh as EventListener)
    }
  }, [farmId, refetchBlocks])

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

  const farmBlockFields = useMemo<BlockFieldDefinition[]>(() => {
    if (!farm) return []
    const fields = ((farm as any).blockFields || []) as BlockFieldDefinition[]
    return Array.isArray(fields) ? fields : []
  }, [farm])

  const getFeatureBlockId = useCallback((feature: GeoJSON.Feature | null | undefined) => {
    if (!feature) return null
    const rawId = feature.id ?? (feature.properties as any)?.id ?? (feature.properties as any)?.blockId
    if (rawId === null || rawId === undefined) return null
    return String(rawId)
  }, [])

  const findBlockFeature = useCallback(
    (blockId: string | null | undefined): GeoJSON.Feature | null => {
      if (!blockId) return null
      return blockFeatures.find((feature) => getFeatureBlockId(feature) === blockId) || null
    },
    [blockFeatures, getFeatureBlockId]
  )

  const focusBlockOnMap = useCallback(
    (feature?: GeoJSON.Feature | null, geometry?: GeoJSON.Geometry | null) => {
      if (!map) return
      const geom = feature?.geometry || geometry
      if (!geom) return
      try {
        const collection: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: geom,
              properties: {},
            },
          ],
        }
        const bounds = bbox(collection) as mapboxgl.LngLatBoundsLike
        map.fitBounds(bounds, { padding: 60, duration: 800 })
      } catch (error) {
        console.warn('Failed to focus block on map:', error)
      }
    },
    [map]
  )

  const openBlockDrawer = useCallback(
    (mode: 'create' | 'edit', blockId?: string | null, blockData?: Block | null) => {
      if (!blockEditingEnabled) {
        showAlert('Block editing is currently disabled for this environment.', 'info')
        return
      }
      setBlockDrawerMode(mode)
      setDrawingMode(mode)
      if (mode === 'edit' && blockId) {
        const entity = blockData || blocks.find((item) => item.id === blockId) || null
        const feature = findBlockFeature(blockId)
        setEditingBlock(entity)
        setEditingFeature(feature)
        focusBlockOnMap(feature, entity?.geometry as GeoJSON.Geometry | undefined)
        setSelectedBlockId(blockId)
      } else {
        setEditingBlock(null)
        setEditingFeature(null)
        setSelectedBlockId(null)
      }
      setBlockDrawerOpen(true)
    },
    [blockEditingEnabled, blocks, findBlockFeature, focusBlockOnMap, showAlert]
  )

  const handleCreateBlock = () => {
    setDetailsOpen(false)
    openBlockDrawer('create')
  }

  const handleEditBlock = useCallback(
    (blockId: string) => {
      setDetailsOpen(false)
      openBlockDrawer('edit', blockId)
    },
    [openBlockDrawer]
  )

  const handleOpenBlockDetails = useCallback(
    (blockId: string) => {
      if (blockDrawerOpen) {
        closeBlockDrawer()
      }
      const entity = blocks.find((item) => item.id === blockId) || null
      const feature = findBlockFeature(blockId)
      setDetailsBlock(entity)
      setDetailsFeature(feature)
      setSelectedBlockId(blockId)
      setDetailsOpen(true)
      setDrawingMode('none')
      focusBlockOnMap(feature, entity?.geometry as GeoJSON.Geometry | undefined)
    },
    [blockDrawerOpen, blocks, closeBlockDrawer, findBlockFeature, focusBlockOnMap]
  )

  const handleStartEditingBlock = useCallback(
    (block: Block) => {
      setDetailsOpen(false)
      openBlockDrawer('edit', block.id, block)
    },
    [openBlockDrawer]
  )

  const handleDeleteBlocks = useCallback(
    async (blockIds: string[]) => {
      if (!blockIds.length) return
      const confirmed = window.confirm(
        `Delete ${blockIds.length} selected block${blockIds.length === 1 ? '' : 's'}? This cannot be undone.`
      )
      if (!confirmed) return

      try {
        await Promise.all(blockIds.map((blockId) => deleteBlock(blockId)))
        emitBlocksRefresh()
        showAlert('Selected blocks deleted.', 'success')
        setSelectedBlockId(null)
        setDetailsOpen(false)
      } catch (error: any) {
        console.error('Failed to delete blocks:', error)
        showAlert(error?.response?.data?.message || 'Failed to delete selected blocks.', 'error')
      }
    },
    [deleteBlock, emitBlocksRefresh, showAlert]
  )

  const handleBulkUpdate = useCallback(
    async (field: BlockFieldDefinition, value: unknown, blockIds: string[]) => {
      if (!blockIds.length) return
      const machineName = field.machineName || field.label
      const revisionMessage = `Bulk updated ${field.label}`

      let payloadValue: unknown = value
      if (field.type === 'Number' || field.type === 'CV Number') {
        payloadValue = typeof value === 'number' ? value : Number(value)
      }
      if (field.type === 'Boolean') {
        payloadValue = Boolean(value)
      }
      if (field.type === 'Date and Time' && value instanceof Date) {
        payloadValue = value.toISOString()
      }

      try {
        await Promise.all(
          blockIds.map((blockId) =>
            updateBlock(blockId, {
              [machineName]: payloadValue,
              revisionMessage,
            } as any)
          )
        )
        emitBlocksRefresh()
        showAlert('Bulk update applied.', 'success')
      } catch (error: any) {
        console.error('Failed to bulk update blocks:', error)
        showAlert(error?.response?.data?.message || 'Bulk update failed.', 'error')
      }
    },
    [emitBlocksRefresh, showAlert, updateBlock]
  )

  const handleShowRevisions = useCallback(
    (block: Block) => {
      setDetailsOpen(false)
      openDrawer('blockRevisions', block.id)
    },
    [openDrawer]
  )

  const handleMapBlockSelect = useCallback(
    (blockId: string, feature: GeoJSON.Feature) => {
      if (drawingMode === 'edit' && blockDrawerOpen) {
        setSelectedBlockId(blockId)
        const entity = blocks.find((item) => item.id === blockId) || null
        setEditingBlock(entity)
        setEditingFeature(feature)
        focusBlockOnMap(feature, entity?.geometry as GeoJSON.Geometry | undefined)
        return
      }

      if (blockDrawerOpen) {
        return
      }

      handleOpenBlockDetails(blockId)
    },
    [blockDrawerOpen, blocks, drawingMode, focusBlockOnMap, handleOpenBlockDetails]
  )

  const handleMapBlockDoubleClick = useCallback(
    (blockId: string, feature: GeoJSON.Feature) => {
      if (drawingMode !== 'edit' || !blockDrawerOpen) return
      setSelectedBlockId(blockId)
      const entity = blocks.find((item) => item.id === blockId) || null
      setEditingBlock(entity)
      setEditingFeature(feature)
    },
    [blockDrawerOpen, blocks, drawingMode]
  )

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

  const handleRequestSelectOnMap = () => {
    setSidebarOpen(false)
  }

  const farmCenter = useMemo(() => {
    if (!farm?.geolocation) return undefined
    return [farm.geolocation.longitude, farm.geolocation.latitude] as [number, number]
  }, [farm])

  useEffect(() => {
    if (!detailsOpen || !detailsBlock?.id) return
    const updatedEntity = blocks.find((item) => item.id === detailsBlock.id) || detailsBlock
    const updatedFeature = findBlockFeature(detailsBlock.id)
    if (updatedEntity !== detailsBlock) {
      setDetailsBlock(updatedEntity)
    }
    if (updatedFeature !== detailsFeature) {
      setDetailsFeature(updatedFeature)
    }
  }, [blocks, blockFeatures, detailsBlock, detailsBlock?.id, detailsFeature, detailsOpen, findBlockFeature])

  useEffect(() => {
    if (!blockDrawerOpen || blockDrawerMode !== 'edit' || !editingBlock?.id) return
    const updatedEntity = blocks.find((item) => item.id === editingBlock.id)
    if (updatedEntity && updatedEntity !== editingBlock) {
      setEditingBlock(updatedEntity)
    }
    const updatedFeature = findBlockFeature(editingBlock?.id)
    if (updatedFeature && updatedFeature !== editingFeature) {
      setEditingFeature(updatedFeature)
    }
  }, [blockDrawerMode, blockDrawerOpen, blocks, editingBlock, editingBlock?.id, editingFeature, findBlockFeature])

  if (!farm) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex relative overflow-hidden">
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
      <CreateBlockDrawer
        isOpen={blockDrawerOpen}
        mode={blockDrawerMode}
        block={editingBlock}
        blockGeometry={(editingFeature?.geometry as GeoJSON.Geometry) || null}
        blockFields={farmBlockFields}
        onClose={closeBlockDrawer}
        onCreate={async (input) => {
          const result = await createBlock(input)
          emitBlocksRefresh()
          return result
        }}
        onUpdate={async (blockId, input) => {
          const result = await updateBlock(blockId, input)
          emitBlocksRefresh()
          return result
        }}
        onDelete={async (blockId) => {
          await deleteBlock(blockId)
          emitBlocksRefresh()
        }}
        onRefetch={refetchBlocks}
      />
      <BlockDetailsDrawer
        isOpen={detailsOpen}
        block={detailsBlock}
        blockFeature={detailsFeature || findBlockFeature(detailsBlock?.id || selectedBlockId || '')}
        blockFields={farmBlockFields}
        measurementSystem={measurementSystem}
        onClose={() => {
          setDetailsOpen(false)
          setDrawingMode('none')
        }}
        onEdit={blockEditingEnabled ? handleStartEditingBlock : undefined}
        onShowRevisions={handleShowRevisions}
      />
      <BlockRevisionsDrawer
        farmId={farmId}
        onOpenBlockEditor={({ mode, block, blockId }) => {
          openBlockDrawer(mode, blockId || block?.id || undefined, block || null)
        }}
      />
      <BlockRevisionPreviewDrawer />

      <FarmSidebar
        farm={farm}
        blocksGeoJson={blockFeatures}
        blockEntities={blocks}
        blockFields={farmBlockFields}
        measurementSystem={measurementSystem}
        blocksLoading={blocksLoading}
        onClose={() => setSidebarOpen(false)}
        onCreateBlock={blockEditingEnabled ? handleCreateBlock : undefined}
        onShowSettings={handleShowSettings}
        onShowCollaborators={handleShowCollaborators}
        onVizUpdate={handleVizUpdate}
        onOpenBlockDetails={handleOpenBlockDetails}
        onEditBlock={blockEditingEnabled ? handleEditBlock : undefined}
        onDeleteBlocks={blockEditingEnabled ? handleDeleteBlocks : undefined}
        onBulkUpdate={blockEditingEnabled ? handleBulkUpdate : undefined}
        onRequestSelectOnMap={handleRequestSelectOnMap}
        onRefreshBlocks={refetchBlocks}
        isOpen={sidebarOpen}
      />

      <div className={`absolute inset-0 transition-all duration-300 ${sidebarOpen ? 'pl-0' : 'pl-0'}`}>
        <MapContainer
          center={farmCenter}
          zoom={11.7}
          blocks={blockFeatures}
          vizSettings={farm.vizSettings}
          enableDrawing={blockEditingEnabled && drawingMode !== 'none'}
          selectedBlockId={selectedBlockId}
          onBlockSelect={handleMapBlockSelect}
          onBlockDoubleClick={blockEditingEnabled ? handleMapBlockDoubleClick : undefined}
        />

        <div className="absolute bottom-6 right-6 z-40 flex max-h-[60vh] flex-col items-end gap-2 overflow-y-auto pr-1">
          <button
            onClick={() => openDrawer('mapLayers')}
            className="flex items-center justify-center rounded-full bg-white/90 p-3 text-gray-700 shadow-md transition hover:bg-white"
            title="Layers & Terrain"
            aria-label="Layers and terrain"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
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

