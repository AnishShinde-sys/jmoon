'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdjustmentsHorizontalIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import bbox from '@turf/bbox'

import BlockDetailsDrawer from '@/components/blocks/BlockDetailsDrawer'
import CreateBlockDrawer from '@/components/blocks/CreateBlockDrawer'
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
import { useUI } from '@/context/UIContext'
import { useMapContext } from '@/context/MapContext'
import { useUserProfile } from '@/context/UserProfileContext'
import { useBlocks } from '@/hooks/useBlocks'
import apiClient from '@/lib/apiClient'
import { Farm } from '@/types/farm'
import { Block, BlockFieldDefinition } from '@/types/block'

interface FarmPageClientProps {
  farmId: string
  layerType?: string
  layerId?: string
}

type LegacyBlockEditorState = {
  mode: 'hidden' | 'create' | 'edit'
  block?: Block | null
  blockId?: string | number
}

export function FarmPageClient({ farmId, layerType, layerId }: FarmPageClientProps) {
  const router = useRouter()
  const { showAlert, openDrawer, closeDrawer, drawers } = useUI()
  const { map, draw } = useMapContext()
  const { profile } = useUserProfile()
  const {
    blocks,
    blocksGeoJSON: blocksJSONFromHook,
    refetch: refetchBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
  } = useBlocks(farmId)

  const [blocksGeoJSON, setBlocksGeoJSON] = useState<any[]>([])
  const [farm, setFarm] = useState<Farm | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [isCreateDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [createDrawerMode, setCreateDrawerMode] = useState<'create' | 'edit'>('create')
  const [editorBlock, setEditorBlock] = useState<Block | null>(null)
  const [editorGeometry, setEditorGeometry] = useState<GeoJSON.Geometry | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsBlock, setDetailsBlock] = useState<Block | null>(null)
  const [detailsFeature, setDetailsFeature] = useState<GeoJSON.Feature | null>(null)

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

  const getFieldKey = useCallback((field: BlockFieldDefinition) => field.machineName || field.label, [])

  const farmDefinedFields = useMemo<BlockFieldDefinition[]>(() => {
    const source = (farm as any)?.blockFields
    if (!Array.isArray(source)) return []
    return source
      .map((field: any) => {
        const machineName = field.machine_name || field.machineName || field.label
        if (!machineName) return null
        return {
          label: field.label || machineName,
          machineName,
          type: field.type || 'Text',
          group: field.group,
          options: field.options || [],
          required: Boolean(field.required),
          hidden: Boolean(field.hidden),
          min: field.min ?? undefined,
          max: field.max ?? undefined,
          step: field.step ?? undefined,
          suffix: field.suffix ?? undefined,
          includeTime: field.includeTime ?? undefined,
        } as BlockFieldDefinition
      })
      .filter((field): field is BlockFieldDefinition => Boolean(field))
  }, [farm])

  const derivedBlockFields = useMemo<BlockFieldDefinition[]>(() => {
    const fieldMap = new Map<string, BlockFieldDefinition>()

    farmDefinedFields.forEach((field) => {
      fieldMap.set(getFieldKey(field), field)
    })

    if (blocksJSONFromHook?.features?.length) {
      const restricted = new Set([
        'id',
        'name',
        'description',
        'area',
        'variety',
        'plantingYear',
        'rowSpacing',
        'vineSpacing',
        'createdAt',
        'updatedAt',
        'farmId',
      ])
      blocksJSONFromHook.features.forEach((feature: any) => {
        const props = (feature.properties || {}) as Record<string, unknown>
        Object.entries(props).forEach(([key, val]) => {
          if (restricted.has(key)) return
          if (fieldMap.has(key)) return
          fieldMap.set(key, {
            label: key,
            machineName: key,
            type: typeof val === 'number' ? 'Number' : 'Text',
          })
        })
      })
    }

    return Array.from(fieldMap.values())
  }, [blocksJSONFromHook, farmDefinedFields, getFieldKey])

  const measurementSystem = profile?.measurementSystem === 'Imperial' ? 'Imperial' : 'Metric'


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

  useEffect(() => {
    if (!map || !draw) return

    const updateDraftState = () => {
      try {
        const drafts = draw
          .getAll()
          .features.filter((feature: any) => !feature?.properties?.__persisted)
        setHasDrawing(drafts.length > 0)
      } catch (error) {
        console.warn('Failed to inspect draw features:', error)
      }
    }

    map.on('draw.create', updateDraftState)
    map.on('draw.delete', updateDraftState)
    map.on('draw.update', updateDraftState)

    updateDraftState()

    return () => {
      map.off('draw.create', updateDraftState)
      map.off('draw.delete', updateDraftState)
      map.off('draw.update', updateDraftState)
    }
  }, [map, draw])

  const startDrawing = useCallback(() => {
    if (!draw) return
    setIsDrawing(true)
    draw.changeMode('draw_polygon')
    showAlert('Click to start drawing a polygon. Double-click to finish.', 'info')
  }, [draw, showAlert])

  const clearDrawing = useCallback(() => {
    if (!draw) return

    try {
      const draftFeatureIds = draw
        .getAll()
        .features.filter((feature: any) => !feature?.properties?.__persisted)
        .map((feature: any) => feature.id)
        .filter((id): id is string => typeof id === 'string')

      if (draftFeatureIds.length) {
        draw.delete(draftFeatureIds)
      }
      draw.changeMode('simple_select')
    } catch (error) {
      console.warn('Failed to clear draft drawings:', error)
    }

    setIsDrawing(false)
    setHasDrawing(false)
  }, [draw])

  const finishDrawing = useCallback(() => {
    if (!draw) return
    setIsDrawing(false)
    draw.changeMode('simple_select')
  }, [draw])

  const findBlockFeature = useCallback(
    (blockId: string) => {
      return blocksGeoJSON.find((feature: any) => {
        const id = feature.id || feature.properties?.id || feature.properties?.blockId
        return String(id) === String(blockId)
      })
    },
    [blocksGeoJSON]
  )

  const focusBlockOnMap = useCallback(
    (blockId: string) => {
      const feature = findBlockFeature(blockId)
      if (map && feature?.geometry) {
        try {
          const bounds = bbox(feature as any)
          map.fitBounds(bounds as [number, number, number, number], { padding: 100, duration: 800 })
        } catch (error) {
          console.error('Error flying to block:', error)
        }
      }
    },
    [findBlockFeature, map]
  )

  const handleCreateBlock = useCallback(() => {
    setCreateDrawerMode('create')
    setEditorBlock(null)
    setEditorGeometry(null)
    setCreateDrawerOpen(true)
    setDetailsOpen(false)
    setSelectedBlockId(null)
    startDrawing()
  }, [startDrawing])

  const handleEditBlock = useCallback(
    (blockId: string) => {
      const blockEntity = blocks.find((item) => item.id === blockId)
      if (!blockEntity) {
        showAlert('Block not found.', 'error')
        return
      }
      const feature = findBlockFeature(blockId)
      setCreateDrawerMode('edit')
      setEditorBlock(blockEntity)
      setEditorGeometry(feature?.geometry || null)
      setCreateDrawerOpen(true)
      setSelectedBlockId(blockId)
      focusBlockOnMap(blockId)
    },
    [blocks, findBlockFeature, focusBlockOnMap, showAlert]
  )

  const handleOpenBlockDetails = useCallback(
    (blockId: string) => {
      const blockEntity = blocks.find((item) => item.id === blockId)
      if (!blockEntity) {
        showAlert('Block not found.', 'error')
        return
      }
      const feature = findBlockFeature(blockId) || null
      setDetailsBlock(blockEntity)
      setDetailsFeature(feature)
      setDetailsOpen(true)
      setSelectedBlockId(blockId)
      focusBlockOnMap(blockId)
    },
    [blocks, findBlockFeature, focusBlockOnMap, showAlert]
  )

  const handleBlockSelectOnMap = useCallback(
    (blockId: string, feature?: any) => {
      if (feature) {
        setDetailsFeature(feature)
      }
      handleOpenBlockDetails(blockId)
    },
    [handleOpenBlockDetails]
  )

  const handleDeleteBlocks = useCallback(
    async (blockIds: string[]) => {
      if (!blockIds.length) return
      try {
        for (const id of blockIds) {
          await deleteBlock(id)
        }
        await refetchBlocks()
        showAlert(`Deleted ${blockIds.length} block${blockIds.length === 1 ? '' : 's'}.`, 'success')
        if (selectedBlockId && blockIds.includes(selectedBlockId)) {
          setSelectedBlockId(null)
          setDetailsOpen(false)
        }
      } catch (error: any) {
        console.error('Bulk delete failed:', error)
        showAlert(error?.response?.data?.message || 'Failed to delete selected blocks.', 'error')
      }
    },
    [deleteBlock, refetchBlocks, selectedBlockId, showAlert]
  )

  const handleBulkUpdate = useCallback(
    async (field: BlockFieldDefinition, value: unknown, blockIds: string[]) => {
      if (!blockIds.length) return
      try {
        let normalizedValue: unknown = value
        if ((field.type === 'Number' || field.type === 'CV Number') && typeof value === 'string') {
          const parsed = Number(value)
          if (!Number.isNaN(parsed)) {
            normalizedValue = parsed
          }
        } else if (field.type === 'Boolean' && typeof value === 'string') {
          normalizedValue = value === 'true'
        }
        if (field.type === 'Date and Time') {
          if (value instanceof Date) {
            normalizedValue = value.toISOString()
          } else if (typeof value === 'string') {
            const asDate = new Date(value)
            if (!Number.isNaN(asDate.getTime())) {
              normalizedValue = asDate.toISOString()
            }
          }
        }

        for (const id of blockIds) {
          const payload: any = {
            revisionMessage: `Bulk update: ${field.label}`,
          }
          payload[field.machineName] = normalizedValue
          await updateBlock(id, payload)
        }
        await refetchBlocks()
        showAlert(`Updated ${blockIds.length} block${blockIds.length === 1 ? '' : 's'}.`, 'success')
      } catch (error: any) {
        console.error('Bulk update failed:', error)
        showAlert(error?.response?.data?.message || 'Failed to apply bulk update.', 'error')
      }
    },
    [refetchBlocks, showAlert, updateBlock]
  )

  const handleLegacyOpenBlockEditor = useCallback(
    (state: LegacyBlockEditorState) => {
      if (state.mode === 'edit') {
        const id = state.block?.id ?? (state.blockId != null ? String(state.blockId) : null)
        if (id) {
          handleEditBlock(String(id))
        }
      } else if (state.mode === 'create') {
        handleCreateBlock()
      }
    },
    [handleCreateBlock, handleEditBlock]
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
      <BlockDetailsDrawer
        isOpen={detailsOpen}
        block={detailsBlock}
        blockFeature={detailsFeature}
        blockFields={derivedBlockFields}
        measurementSystem={measurementSystem}
        onClose={() => setDetailsOpen(false)}
        onEdit={(block) => handleEditBlock(block.id)}
        onShowRevisions={(block) => openDrawer('blockRevisions', block.id)}
      />

      <CreateBlockDrawer
        isOpen={isCreateDrawerOpen}
        mode={createDrawerMode}
        block={editorBlock}
        blockGeometry={editorGeometry}
        blockFields={farmDefinedFields}
        onClose={() => {
          setCreateDrawerOpen(false)
          clearDrawing()
        }}
        onCreate={createBlock}
        onUpdate={updateBlock}
        onDelete={deleteBlock}
        onRefetch={refetchBlocks}
      />

      <BlockRevisionsDrawer farmId={farmId} onOpenBlockEditor={handleLegacyOpenBlockEditor} />
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
        blocksGeoJson={blocksGeoJSON}
        blockEntities={blocks}
        blockFields={derivedBlockFields}
        measurementSystem={measurementSystem}
        onClose={() => setSidebarOpen(false)}
        onCreateBlock={handleCreateBlock}
        onShowSettings={handleShowSettings}
        onShowCollaborators={handleShowCollaborators}
        onVizUpdate={handleVizUpdate}
        isOpen={sidebarOpen}
        onOpenBlockDetails={handleOpenBlockDetails}
        onEditBlock={handleEditBlock}
        onDeleteBlocks={handleDeleteBlocks}
        onBulkUpdate={handleBulkUpdate}
        loadingBlocks={!blocksJSONFromHook}
      />

      <div className={`absolute inset-0 transition-all duration-300 ${sidebarOpen ? 'pl-0' : 'pl-0'}`}>
        <MapContainer
          center={farmCenter}
          zoom={11.7}
          enableDrawing
          blocks={blocksGeoJSON}
          onBlockSelect={handleBlockSelectOnMap}
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

