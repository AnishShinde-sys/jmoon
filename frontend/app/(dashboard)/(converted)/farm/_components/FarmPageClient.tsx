'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdjustmentsHorizontalIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import bbox from '@turf/bbox'

import type { BlockEditorState } from '@/components/blocks/BlockEditorPanel'
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
  const { showAlert, openDrawer, closeDrawer, drawers } = useUI()
  const { map, draw } = useMapContext()
  const {
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
  const [selectedBlockData, setSelectedBlockData] = useState<any | null>(null)
  const [blockEditorState, setBlockEditorState] = useState<BlockEditorState>({ mode: 'hidden' })

  const normalizeCustomFields = useCallback((fields: any[] | undefined | null) => {
    if (!Array.isArray(fields)) return []
    return fields.map((field: any, index: number) => ({
      ...field,
      key: field?.key ?? `${field?.label ?? 'field'}_${index}`,
    }))
  }, [])

  const normalizeBlockPayload = useCallback(
    (blockPayload: any | undefined | null) => {
      if (!blockPayload) return null

      const customFields = normalizeCustomFields(blockPayload.customFields)
      return {
        ...blockPayload,
        customFields,
      }
    },
    [normalizeCustomFields]
  )

  const openBlockEditor = useCallback(
    (state: BlockEditorState) => {
      setBlockEditorState(state)

      if (state.mode === 'edit') {
        if (state.block) {
          const normalized = normalizeBlockPayload(state.block)
          if (normalized) {
            setSelectedBlockId(String(normalized.id))
            setSelectedBlockData(normalized)
          }
        } else if (state.blockId) {
          setSelectedBlockId(String(state.blockId))
          setSelectedBlockData(null)
        }
      }

      if (state.mode === 'create') {
        setSelectedBlockId(null)
        setSelectedBlockData(null)
      }
    },
    [normalizeBlockPayload]
  )

  const getBlockFeatureId = useCallback((feature: any): string | null => {
    if (!feature) return null
    const rawId = feature.id ?? feature.properties?.id ?? feature.properties?.blockId
    if (rawId === undefined || rawId === null) return null
    return String(rawId)
  }, [])

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
        features.features.forEach((feature: any) => {
          if (!feature?.properties?.__persisted && feature?.id) {
            try {
              draw.setFeatureProperty(feature.id, '__draft', true)
            } catch (error) {
              console.warn('Failed to tag draft feature', error)
            }
          }
        })
        setHasDrawing(true)
        setIsDrawing(false)
        openBlockEditor({ mode: 'create' })
      }
    }

    const handleDrawUpdate = (event: any) => {
      const updatedFeatures = (event?.features || []) as any[]
      if (!updatedFeatures.length) return

      setBlocksGeoJSON((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev

        let didChange = false
        const updatesById = new Map<string, any>()
        updatedFeatures.forEach((feature) => {
          const featureId = getBlockFeatureId(feature)
          if (featureId) {
            updatesById.set(featureId, feature)
          }
        })

        if (updatesById.size === 0) return prev

        const next = prev.map((feature: any) => {
          const featureId = getBlockFeatureId(feature)
          if (!featureId) return feature
          const updated = updatesById.get(featureId)
          if (updated && updated.geometry) {
            didChange = true
            return {
              ...feature,
              geometry: updated.geometry,
            }
          }
          return feature
        })

        return didChange ? next : prev
      })
    }

    const handleDrawDelete = () => {
      const features = draw.getAll()
      setHasDrawing(features.features.length > 0)
    }

    map.on('draw.create', handleDrawCreate)
    map.on('draw.update', handleDrawUpdate)
    map.on('draw.delete', handleDrawDelete)

    return () => {
      map.off('draw.create', handleDrawCreate)
      map.off('draw.update', handleDrawUpdate)
      map.off('draw.delete', handleDrawDelete)
    }
  }, [map, draw, getBlockFeatureId, openBlockEditor])

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

    const draftFeatureIds = draw
      .getAll()
      .features.filter((feature: any) => !feature?.properties?.__persisted)
      .map((feature: any) => feature.id)
      .filter((id): id is string => typeof id === 'string')

    if (draftFeatureIds.length) {
      draw.delete(draftFeatureIds)
    }

    setIsDrawing(false)
    setHasDrawing(false)
  }

  const finishDrawing = () => {
    if (!draw) return
    setIsDrawing(false)
    draw.changeMode('simple_select')
  }

  const handleBlockClick = (blockId: string, feature?: any) => {
    setSelectedBlockId(blockId)
    closeDrawer('farmDetails')

    let blockFeature = feature

    if (!blockFeature && blocksGeoJSON.length > 0) {
      blockFeature = blocksGeoJSON.find((b: any) => {
        const id = b.id || b.properties?.id
        return id === blockId
      })
    }

    if (map && blockFeature?.geometry) {
      try {
        const bounds = bbox(blockFeature as any)
        map.fitBounds(bounds as [number, number, number, number], { padding: 100, duration: 1000 })
      } catch (error) {
        console.error('Error flying to block:', error)
      }
    }

    const blockPayload = blockFeature
      ? {
          id: blockId,
          ...(blockFeature.properties || {}),
          geometry: blockFeature.geometry,
        }
      : undefined

    if (blockPayload) {
      const normalized = normalizeBlockPayload(blockPayload)
      openBlockEditor({ mode: 'edit', block: normalized || undefined, blockId })
    } else {
      openBlockEditor({ mode: 'edit', blockId })
    }
  }

  const handleBlockSelectOnMap = (blockId: string, feature?: any) => {
    handleBlockClick(blockId, feature)
  }

  const handleOpenBlockDrawer = () => {
    if (selectedBlockData) {
      openBlockEditor({ mode: 'edit', block: selectedBlockData, blockId: selectedBlockData.id })
      return
    }

    if (blocksGeoJSON.length > 0) {
      const firstFeature = blocksGeoJSON[0]
      const firstId = firstFeature?.id || firstFeature?.properties?.id
      if (firstId) {
        handleBlockClick(String(firstId), firstFeature)
        return
      }
    }

    showAlert('Select or draw a block to edit.', 'info')
  }
  useEffect(() => {
    if (!selectedBlockId) {
      setSelectedBlockData(null)
      return
    }

    const blockFeature = blocksGeoJSON.find((feature: any) => {
      const id = feature.id || feature.properties?.id
      return String(id) === String(selectedBlockId)
    })

    if (blockFeature) {
      const payload = {
        id: selectedBlockId,
        ...(blockFeature.properties || {}),
        geometry: blockFeature.geometry,
      }

      const customFields = Array.isArray(payload.customFields)
        ? payload.customFields.map((field: any, index: number) => ({
            ...field,
            key: field?.key ?? `${field?.label ?? 'field'}_${index}`,
          }))
        : []

      const normalized = {
        ...payload,
        customFields,
      }

      setSelectedBlockData(normalized)

      if (
        blockEditorState.mode === 'edit' &&
        (blockEditorState.blockId || blockEditorState.block?.id) === selectedBlockId
      ) {
        openBlockEditor({ mode: 'edit', block: normalized, blockId: selectedBlockId })
      }
    } else {
      setSelectedBlockData(null)
      if (
        blockEditorState.mode === 'edit' &&
        (blockEditorState.blockId || blockEditorState.block?.id) === selectedBlockId
      ) {
        openBlockEditor({ mode: 'hidden' })
      }
    }
  }, [blocksGeoJSON, selectedBlockId, blockEditorState, openBlockEditor])


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
      <BlockRevisionsDrawer farmId={farmId} onOpenBlockEditor={openBlockEditor} />
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
        onOpenBlockDrawer={handleOpenBlockDrawer}
        selectedBlockId={selectedBlockId}
        blockEditorState={blockEditorState}
        onBlockEditorStateChange={openBlockEditor}
        createBlock={createBlock}
        updateBlock={updateBlock}
        deleteBlock={deleteBlock}
        refetchBlocks={refetchBlocks}
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

