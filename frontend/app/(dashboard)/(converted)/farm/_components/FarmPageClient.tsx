'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import type mapboxgl from 'mapbox-gl'
import { useRouter } from 'next/navigation'
import { AdjustmentsHorizontalIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import bbox from '@turf/bbox'
import area from '@turf/area'
import type { Feature as GeoFeature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'

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
import { Block, BlockFieldDefinition, BlockRevision } from '@/types/block'
import { Farm, VizSettings } from '@/types/farm'
import { fetchBlockRevisions, revertBlockRevision } from '@/services/blocks'

const REVISION_PREVIEW_SOURCE_ID = 'block-revision-preview'
const REVISION_PREVIEW_LAYER_ID = 'block-revision-preview-fill'
const REVISION_PREVIEW_OUTLINE_LAYER_ID = 'block-revision-preview-outline'

interface FarmPageClientProps {
  farmId: string
  layerType?: string
  layerId?: string
}

export function FarmPageClient({ farmId, layerType, layerId }: FarmPageClientProps) {
  const router = useRouter()
  const { showAlert, openDrawer, closeDrawer, drawers } = useUI()
  const { map, draw, setDrawingEnabled } = useMapContext()
  const { profile } = useUserProfile()
  const {
    blocks,
    blocksGeoJSON: blocksCollection,
    loading: blocksLoading,
    refetch: refetchBlocks,
    createBlock,
    deleteBlock,
    updateBlock,
  } = useBlocks(farmId)

  const [blockFeatures, setBlockFeatures] = useState<GeoJSON.Feature[]>([])
  const [farm, setFarm] = useState<Farm | null>(null)
  const [previewVizSettings, setPreviewVizSettings] = useState<VizSettings | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [detailsBlock, setDetailsBlock] = useState<Block | null>(null)
  const [detailsFeature, setDetailsFeature] = useState<GeoJSON.Feature | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [blockDraftMode, setBlockDraftMode] = useState<'create' | 'edit' | null>(null)
  const [draftBlockId, setDraftBlockId] = useState<string | null>(null)
  const [draftFeature, setDraftFeature] = useState<GeoFeature | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)
  const [showBlockRevisions, setShowBlockRevisions] = useState(false)
  const [previewRevisionFeature, setPreviewRevisionFeature] = useState<GeoFeature | null>(null)
  const [previewRevisionId, setPreviewRevisionId] = useState<string | null>(null)
  const originalFeatureRef = useRef<GeoFeature | null>(null)

  const isDraftingBlock = blockDraftMode !== null
  const isCreatingBlock = blockDraftMode === 'create'
  const isEditingBlock = blockDraftMode === 'edit'
  const measurementSystem = profile?.measurementSystem || 'Metric'

  const notifyEditingUnavailable = useCallback(() => {
    showAlert('Press the Edit button to modify this block.', 'info')
  }, [showAlert])

  const handlePreviewVizSettings = useCallback((settings: VizSettings) => {
    setPreviewVizSettings(settings)
  }, [])

  const handleResetVizPreview = useCallback(() => {
    setPreviewVizSettings(null)
  }, [])

  const normalizeFeature = useCallback((feature: GeoJSON.Feature | any): GeoJSON.Feature => {
    if (!feature) {
      return {
        type: 'Feature',
        geometry: null,
        properties: {},
      }
    }

    let cloned: GeoJSON.Feature
    try {
      cloned = JSON.parse(JSON.stringify(feature)) as GeoJSON.Feature
    } catch (error) {
      cloned = {
        type: 'Feature',
        geometry: feature.geometry ?? null,
        properties: { ...(feature.properties ?? {}) },
      }
    }

    cloned.properties = { ...(cloned.properties ?? {}) }
    const props = cloned.properties as Record<string, unknown>
    const rawId = cloned.id ?? props.id ?? props.blockId
    if (rawId !== undefined && rawId !== null) {
      cloned.id = String(rawId)
      props.id = props.id ?? String(rawId)
    }

    ;(cloned.properties as Record<string, unknown>).__persisted = true
    return cloned
  }, [])

  useEffect(() => {
    if (blocksCollection?.features && Array.isArray(blocksCollection.features)) {
      const normalized = blocksCollection.features.map((feature: any) => normalizeFeature(feature))
      setBlockFeatures(normalized)
    } else {
      setBlockFeatures([])
    }
  }, [blocksCollection, normalizeFeature])

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

  const clearDraftFeatures = useCallback(
    (options?: { keepId?: string | null }) => {
      if (!draw) return
      const keepId = options?.keepId ?? null
      let collection: FeatureCollection | null = null
      try {
        collection = draw.getAll()
      } catch (error) {
        console.warn('Failed to read draw features:', error)
        return
      }

      if (!collection || !Array.isArray(collection.features)) return

      collection.features.forEach((feature: any) => {
        const id = typeof feature?.id === 'string' ? feature.id : null
        const isPersisted = Boolean(feature?.properties?.__persisted)
        if (isPersisted) return
        if (keepId && id === keepId) return
        if (id) {
          try {
            draw.delete(id)
          } catch (error) {
            console.warn('Failed to delete draft feature:', error)
          }
        }
      })
    },
    [draw]
  )

  const handleResetDraftGeometry = useCallback(() => {
    if (blockDraftMode === 'create') {
      clearDraftFeatures()
      setDraftFeature(null)
      if (draw) {
        try {
          draw.changeMode('draw_polygon' as any)
        } catch (error) {
          console.warn('Failed to return to draw mode:', error)
        }
      }
      return
    }

    if (blockDraftMode === 'edit') {
      if (originalFeatureRef.current) {
        const clone = JSON.parse(JSON.stringify(originalFeatureRef.current)) as GeoFeature
        setDraftFeature(clone)
      } else {
        setDraftFeature(null)
      }
      refetchBlocks().then(() => {
        if (draw && draftBlockId) {
          try {
            draw.changeMode('simple_select' as any)
            draw.changeMode('direct_select' as any, { featureId: draftBlockId })
          } catch (error) {
            console.warn('Failed to reselect block after reset:', error)
          }
        }
      })
    }
  }, [blockDraftMode, clearDraftFeatures, draw, refetchBlocks, draftBlockId])

  const handleCancelCreateBlock = useCallback(() => {
    if (blockDraftMode === 'edit') {
      refetchBlocks()
    } else {
      clearDraftFeatures()
    }
    setBlockDraftMode(null)
    setDraftBlockId(null)
    setDraftFeature(null)
    setDraftName('')
    setDraftDescription('')
    setSavingDraft(false)
    originalFeatureRef.current = null
    setShowBlockRevisions(false)
    setPreviewRevisionFeature(null)
    setPreviewRevisionId(null)
  }, [blockDraftMode, clearDraftFeatures, refetchBlocks])

  const handleCreateBlock = useCallback(() => {
    if (!map) {
      showAlert('Map is still loading. Try again in a moment.', 'warning')
      return
    }

    setSidebarOpen(true)
    setShowBlockRevisions(false)
    setPreviewRevisionFeature(null)
    setPreviewRevisionId(null)
    setBlockDraftMode('create')
    setDraftBlockId(null)
    setDraftFeature(null)
    setDraftName('')
    setDraftDescription('')
    setSelectedBlockId(null)
    setDetailsBlock(null)
    setDetailsFeature(null)
    originalFeatureRef.current = null
    clearDraftFeatures()
    showAlert('Drawing mode enabled. Outline the block on the map.', 'info')
  }, [map, showAlert, clearDraftFeatures])

  const handleStartEditingBlock = useCallback(
    (block: Block) => {
      const feature = findBlockFeature(block.id)
      if (!feature || !feature.geometry) {
        showAlert('Block geometry is not available for editing.', 'error')
        return
      }

      const featureClone = JSON.parse(JSON.stringify(feature)) as GeoFeature
      featureClone.id = block.id

      originalFeatureRef.current = JSON.parse(JSON.stringify(feature)) as GeoFeature
      clearDraftFeatures()

      setSidebarOpen(true)
      setShowBlockRevisions(false)
      setPreviewRevisionFeature(null)
      setPreviewRevisionId(null)
      setBlockDraftMode('edit')
      setDraftBlockId(block.id)
      setDraftFeature(featureClone)
      setDraftName(block.name ?? '')
      setDraftDescription(block.description ?? '')
      setDetailsBlock(block)
      setDetailsFeature(feature)
      setSelectedBlockId(block.id)
      focusBlockOnMap(feature, block.geometry as GeoJSON.Geometry | undefined)
      showAlert('Editing mode enabled. Drag vertices to adjust the block or update the details.', 'info')
    },
    [findBlockFeature, clearDraftFeatures, focusBlockOnMap, showAlert]
  )

  const handleEditBlock = useCallback(
    (blockId: string) => {
      const block = blocks.find((item) => item.id === blockId)
      if (!block) {
        showAlert('Block not found.', 'error')
        return
      }
      handleStartEditingBlock(block)
    },
    [blocks, handleStartEditingBlock, showAlert]
  )

  const handleOpenBlockDetails = useCallback(
    (blockId: string) => {
      const entity = blocks.find((item) => item.id === blockId) || null
      const feature = findBlockFeature(blockId)
      setDetailsBlock(entity)
      setDetailsFeature(feature)
      setSelectedBlockId(blockId)
      setShowBlockRevisions(false)
      setPreviewRevisionFeature(null)
      setPreviewRevisionId(null)
      focusBlockOnMap(feature, entity?.geometry as GeoJSON.Geometry | undefined)
    },
    [blocks, findBlockFeature, focusBlockOnMap]
  )

  const handleCloseRevisions = useCallback(() => {
    setShowBlockRevisions(false)
    setPreviewRevisionFeature(null)
    setPreviewRevisionId(null)
  }, [])

  const handleDeleteBlocks = useCallback(
    async (blockIds: string[]) => {
      if (!blockIds.length) return

      const message = blockIds.length === 1
        ? 'Delete this block? This action cannot be undone.'
        : `Delete ${blockIds.length} blocks? This action cannot be undone.`
      const confirmed = window.confirm(message)
      if (!confirmed) return

      try {
        for (const id of blockIds) {
          await deleteBlock(id)
        }
        showAlert('Block deletion complete.', 'success')
        if (blockIds.includes(detailsBlock?.id || '')) {
          setDetailsBlock(null)
          setDetailsFeature(null)
          setSelectedBlockId(null)
          handleCloseRevisions()
        }
      } catch (error: any) {
        console.error('Failed to delete blocks:', error)
        showAlert(error?.response?.data?.message || 'Failed to delete blocks.', 'error')
      }
    },
    [deleteBlock, showAlert, detailsBlock, handleCloseRevisions]
  )

  const handleBulkUpdate = useCallback(
    async (_field: BlockFieldDefinition, _value: unknown, blockIds: string[]) => {
      if (!blockIds.length) return
      notifyEditingUnavailable()
    },
    [notifyEditingUnavailable]
  )

  const handleShowRevisions = useCallback(
    (block: Block) => {
      const feature = findBlockFeature(block.id)
      setShowBlockRevisions(true)
      setPreviewRevisionFeature(null)
      setPreviewRevisionId(null)
      setSidebarOpen(true)
      setDetailsBlock(block)
      setDetailsFeature(feature)
      setSelectedBlockId(block.id)
      if (feature) {
        focusBlockOnMap(feature, block.geometry as GeoJSON.Geometry | undefined)
      }
    },
    [findBlockFeature, focusBlockOnMap]
  )

  const loadBlockRevisions = useCallback(
    (blockId: string) => fetchBlockRevisions(farmId, blockId),
    [farmId]
  )

  const handlePreviewRevision = useCallback(
    (revision: BlockRevision | null) => {
      if (!revision || !revision.geometry) {
        setPreviewRevisionFeature(null)
        setPreviewRevisionId(null)
        return
      }

      const feature: GeoFeature = {
        type: 'Feature',
        id: revision.id,
        geometry: revision.geometry as GeoJSON.Geometry,
        properties: {
          ...(revision.properties || {}),
          revisionId: revision.id,
        } as Record<string, unknown>,
      }

      setPreviewRevisionFeature(feature)
      setPreviewRevisionId(revision.id)
      focusBlockOnMap(feature, feature.geometry as GeoJSON.Geometry)
    },
    [focusBlockOnMap]
  )

  const handleRevertBlockRevision = useCallback(
    async (revisionId: string, message?: string) => {
      const targetBlockId = detailsBlock?.id || selectedBlockId
      if (!targetBlockId) {
        showAlert('Select a block before reverting.', 'warning')
        return
      }

      try {
        await revertBlockRevision(farmId, targetBlockId, revisionId, message)
        showAlert('Block reverted to the selected revision.', 'success')
        setPreviewRevisionFeature(null)
        setPreviewRevisionId(null)
        await refetchBlocks()
      } catch (error: any) {
        console.error('Failed to revert block revision:', error)
        showAlert(error?.response?.data?.message || 'Failed to revert block revision.', 'error')
      }
    },
    [detailsBlock?.id, selectedBlockId, farmId, refetchBlocks, showAlert]
  )

  const handleMapBlockSelect = useCallback(
    (blockId: string) => {
      if (isDraftingBlock) return
      handleOpenBlockDetails(blockId)
    },
    [isDraftingBlock, handleOpenBlockDetails]
  )

  const handleMapBlockDoubleClick = useCallback(
    (blockId: string) => {
      if (isDraftingBlock) return
      notifyEditingUnavailable()
    },
    [isDraftingBlock, notifyEditingUnavailable]
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

  const handleVizUpdate = useCallback(
    async (settings: VizSettings) => {
      if (!farm) return
      const previousSettings = farm.vizSettings
      console.debug('[FarmPageClient] Saving viz settings', settings)
      setFarm({ ...farm, vizSettings: settings })
      setPreviewVizSettings(null)
      try {
        const response = await apiClient.put(`/api/farms/${farmId}`, {
          vizSettings: settings,
        })
        setFarm(response.data)
        showAlert('Visualization settings updated.', 'success')
      } catch (error: any) {
        console.error('[FarmPageClient] Failed to update visualization settings:', error)
        setFarm((prev) => (prev ? { ...prev, vizSettings: previousSettings } : prev))
        setPreviewVizSettings(null)
        showAlert(error?.response?.data?.message || 'Failed to update visualization settings.', 'error')
        throw error
      }
    },
    [farm, farmId, showAlert]
  )

  const handleRequestSelectOnMap = () => {
    setSidebarOpen(false)
  }

  const handleClearSelectedBlock = useCallback(() => {
    setSelectedBlockId(null)
    setDetailsBlock(null)
    setDetailsFeature(null)
    setShowBlockRevisions(false)
    setPreviewRevisionFeature(null)
    setPreviewRevisionId(null)
  }, [])

  useEffect(() => {
    if (!draw) return

    if (isDraftingBlock) {
      setDrawingEnabled(true)
      if (isCreatingBlock) {
        try {
          draw.changeMode('draw_polygon' as any)
        } catch (error) {
          console.warn('Failed to enable polygon draw mode:', error)
        }
      } else if (isEditingBlock && draftBlockId) {
        try {
          draw.changeMode('simple_select' as any)
          draw.changeMode('direct_select' as any, { featureId: draftBlockId })
        } catch (error) {
          console.warn('Failed to enter edit mode for block:', error)
        }
      }
    } else {
      try {
        draw.changeMode('simple_select' as any)
      } catch (error) {
        // ignore
      }
      setDrawingEnabled(false)
      clearDraftFeatures()
    }
  }, [isDraftingBlock, isCreatingBlock, isEditingBlock, draftBlockId, draw, clearDraftFeatures, setDrawingEnabled])

  useEffect(() => {
    if (!map || !draw) return

    const handleDrawCreate = (event: any) => {
      if (blockDraftMode !== 'create') return
      const feature = event.features?.[0] as GeoFeature | undefined
      if (!feature || !feature.geometry) return
      if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
        showAlert('Blocks must be polygons. Please draw a polygon.', 'warning')
        const id = typeof feature.id === 'string' ? feature.id : null
        if (id) {
          try {
            draw.delete(id)
          } catch (error) {
            console.warn('Failed to delete non-polygon draft:', error)
          }
        }
        return
      }

      const keepId = typeof feature.id === 'string' ? feature.id : null
      clearDraftFeatures({ keepId })
      setDraftFeature(feature)
    }

    const handleDrawUpdate = (event: any) => {
      if (!isDraftingBlock) return
      const feature = event.features?.[0] as GeoFeature | undefined
      if (!feature || !feature.geometry) return

      if (blockDraftMode === 'edit' && draftBlockId) {
        const featureId = typeof feature.id === 'string' ? feature.id : null
        if (featureId !== draftBlockId) return
      }

      setDraftFeature(feature)
    }

    const handleDrawDelete = (event: any) => {
      if (!isDraftingBlock) return
      const feature = event.features?.[0] as GeoFeature | undefined
      const isPersisted = Boolean(feature?.properties?.__persisted)
      const featureId = typeof feature?.id === 'string' ? feature.id : null

      if (blockDraftMode === 'create') {
        if (!isPersisted) {
          setDraftFeature(null)
        }
      } else if (blockDraftMode === 'edit') {
        if (featureId && featureId === draftBlockId) {
          setDraftFeature(null)
        }
      }
    }

    map.on('draw.create', handleDrawCreate)
    map.on('draw.update', handleDrawUpdate)
    map.on('draw.delete', handleDrawDelete)

    return () => {
      map.off('draw.create', handleDrawCreate)
      map.off('draw.update', handleDrawUpdate)
      map.off('draw.delete', handleDrawDelete)
    }
  }, [map, draw, blockDraftMode, clearDraftFeatures, showAlert, isDraftingBlock, draftBlockId])

  const draftAreaSqMeters = useMemo(() => {
    if (!draftFeature?.geometry) return null
    try {
      return area(draftFeature as any)
    } catch (error) {
      console.warn('Failed to compute draft area:', error)
      return null
    }
  }, [draftFeature])

  useEffect(() => {
    if (!map) return

    const removePreviewLayers = () => {
      if (map.getLayer(REVISION_PREVIEW_LAYER_ID)) {
        map.removeLayer(REVISION_PREVIEW_LAYER_ID)
      }
      if (map.getLayer(REVISION_PREVIEW_OUTLINE_LAYER_ID)) {
        map.removeLayer(REVISION_PREVIEW_OUTLINE_LAYER_ID)
      }
      if (map.getSource(REVISION_PREVIEW_SOURCE_ID)) {
        map.removeSource(REVISION_PREVIEW_SOURCE_ID)
      }
    }

    if (!previewRevisionFeature) {
      removePreviewLayers()
      return
    }

    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [previewRevisionFeature as any],
    }

    if (map.getSource(REVISION_PREVIEW_SOURCE_ID)) {
      ;(map.getSource(REVISION_PREVIEW_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(collection as any)
    } else {
      map.addSource(REVISION_PREVIEW_SOURCE_ID, {
        type: 'geojson',
        data: collection as any,
      })
    }

    if (!map.getLayer(REVISION_PREVIEW_LAYER_ID)) {
      map.addLayer({
        id: REVISION_PREVIEW_LAYER_ID,
        type: 'fill',
        source: REVISION_PREVIEW_SOURCE_ID,
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.45,
        },
      })
    }

    if (!map.getLayer(REVISION_PREVIEW_OUTLINE_LAYER_ID)) {
      map.addLayer({
        id: REVISION_PREVIEW_OUTLINE_LAYER_ID,
        type: 'line',
        source: REVISION_PREVIEW_SOURCE_ID,
        paint: {
          'line-width': 2,
          'line-color': '#f59e0b',
        },
      })
    }

    return () => {
      removePreviewLayers()
    }
  }, [map, previewRevisionFeature])

  const handleSaveDraftBlock = useCallback(async () => {
    if (!draftName.trim()) {
      showAlert('Enter a block name before saving.', 'warning')
      return
    }

    const geometrySource = (() => {
      if (draftFeature?.geometry) {
        return draftFeature.geometry
      }
      if (blockDraftMode === 'edit' && draftBlockId && draw) {
        const existing = draw.get(draftBlockId)
        if (existing?.geometry) {
          return existing.geometry
        }
      }
      return null
    })()

    if (!geometrySource) {
      showAlert('Draw or adjust the block footprint before saving.', 'warning')
      return
    }

    const geometry = JSON.parse(JSON.stringify(geometrySource)) as Polygon | MultiPolygon

    setSavingDraft(true)
    try {
      if (blockDraftMode === 'edit') {
        if (!draftBlockId) {
          showAlert('No block selected for editing.', 'error')
          return
        }
        const updated = await updateBlock(draftBlockId, {
          name: draftName.trim(),
          description: draftDescription.trim() || undefined,
          geometry,
        })
        showAlert('Block updated successfully.', 'success')
        setBlockDraftMode(null)
        setDraftBlockId(null)
        originalFeatureRef.current = null
        setDraftFeature(null)
        setDraftName('')
        setDraftDescription('')
        await refetchBlocks()
        setDetailsBlock((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
        setSelectedBlockId(updated.id)
      } else {
        console.debug('[FarmPageClient] Creating new block', {
          name: draftName.trim(),
          description: draftDescription.trim(),
          geometry,
        })

        const createdFeature = await createBlock({
          name: draftName.trim(),
          description: draftDescription.trim() || undefined,
          geometry,
        })
        console.debug('[FarmPageClient] Block created response', createdFeature)
        showAlert('Block created successfully.', 'success')
        const normalizedFeature = normalizeFeature(createdFeature as any)
        const createdBlockId = getFeatureBlockId(normalizedFeature)
        if (createdBlockId) {
          setBlockFeatures((prev) => {
            const existingIndex = prev.findIndex((feature) => getFeatureBlockId(feature) === createdBlockId)
            const next = [...prev]
            if (existingIndex >= 0) {
              next[existingIndex] = normalizedFeature
            } else {
              next.push(normalizedFeature)
            }
            return next
          })

          const properties = (normalizedFeature.properties ?? {}) as Partial<Block>
          const mergedBlock: Block = {
            id: createdBlockId,
            farmId: farmId,
            name: (properties.name as string) || draftName.trim(),
            description: typeof properties.description === 'string' ? properties.description : undefined,
            variety: typeof properties.variety === 'string' ? properties.variety : undefined,
            plantingYear: typeof properties.plantingYear === 'number' ? properties.plantingYear : undefined,
            rowSpacing: typeof properties.rowSpacing === 'number' ? properties.rowSpacing : undefined,
            vineSpacing: typeof properties.vineSpacing === 'number' ? properties.vineSpacing : undefined,
            area: typeof properties.area === 'number' ? properties.area : area(geometry),
            createdAt: (properties.createdAt as string) || new Date().toISOString(),
            updatedAt: (properties.updatedAt as string) || new Date().toISOString(),
            revisionMessage: typeof properties.revisionMessage === 'string' ? properties.revisionMessage : undefined,
            updatedBy: typeof properties.updatedBy === 'string' ? properties.updatedBy : undefined,
            updatedByName: typeof properties.updatedByName === 'string' ? properties.updatedByName : undefined,
            geometry,
          }

          console.debug('[FarmPageClient] Selecting newly created block', {
            createdBlockId,
            mergedBlock,
          })
          setDetailsBlock(mergedBlock)
          setDetailsFeature(normalizedFeature)
          setSelectedBlockId(createdBlockId)
          focusBlockOnMap(normalizedFeature, geometry)
        }

        clearDraftFeatures()
        console.debug('[FarmPageClient] Refreshing blocks after create')
        await refetchBlocks()
      }
    } catch (error: any) {
      console.error('[FarmPageClient] Failed to save block draft:', error)
      showAlert(error?.response?.data?.message || 'Failed to save block changes.', 'error')
    } finally {
      setSavingDraft(false)
    }
  }, [
    blockDraftMode,
    draftBlockId,
    draftFeature,
    draftName,
    draftDescription,
    draw,
    updateBlock,
    createBlock,
    showAlert,
    clearDraftFeatures,
    refetchBlocks,
    normalizeFeature,
    getFeatureBlockId,
    focusBlockOnMap,
    farmId,
  ])

  const handleFocusSelectedBlock = useCallback(() => {
    if (!detailsBlock) return
    focusBlockOnMap(detailsFeature, detailsBlock.geometry as GeoJSON.Geometry | undefined)
  }, [detailsBlock, detailsFeature, focusBlockOnMap])

  const farmCenter = useMemo(() => {
    if (!farm?.geolocation) return undefined
    return [farm.geolocation.longitude, farm.geolocation.latitude] as [number, number]
  }, [farm])

  useEffect(() => {
    if (!detailsBlock?.id) return
    const updatedEntity = blocks.find((item) => item.id === detailsBlock.id)
    const updatedFeature = findBlockFeature(detailsBlock.id)
    if (updatedEntity && updatedEntity !== detailsBlock) {
      setDetailsBlock(updatedEntity)
    }
    if (updatedFeature && updatedFeature !== detailsFeature) {
      setDetailsFeature(updatedFeature)
    }
  }, [blocks, blockFeatures, detailsBlock, detailsBlock?.id, detailsFeature, findBlockFeature])

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
      <FarmSidebar
        farm={farm}
        blocksGeoJson={blockFeatures}
        blockEntities={blocks}
        blockFields={farm.blockFields || []}
        measurementSystem={measurementSystem}
        blocksLoading={blocksLoading}
        onClose={() => setSidebarOpen(false)}
        onCreateBlock={handleCreateBlock}
        onShowSettings={handleShowSettings}
        onShowCollaborators={handleShowCollaborators}
        onVizUpdate={handleVizUpdate}
        onVizPreviewChange={handlePreviewVizSettings}
        onVizPreviewReset={handleResetVizPreview}
        onOpenBlockDetails={handleOpenBlockDetails}
        onEditBlock={handleEditBlock}
        onDeleteBlocks={handleDeleteBlocks}
        onBulkUpdate={handleBulkUpdate}
        onRequestSelectOnMap={handleRequestSelectOnMap}
        onRefreshBlocks={refetchBlocks}
        isOpen={sidebarOpen}
        blockDraftMode={blockDraftMode}
        createBlockName={draftName}
        createBlockDescription={draftDescription}
        createBlockHasGeometry={Boolean(draftFeature?.geometry)}
        createBlockAreaSqMeters={draftAreaSqMeters}
        onChangeCreateBlockName={setDraftName}
        onChangeCreateBlockDescription={setDraftDescription}
        onCancelCreateBlock={handleCancelCreateBlock}
        onSaveCreateBlock={handleSaveDraftBlock}
        onResetCreateBlockGeometry={handleResetDraftGeometry}
        createBlockSaving={savingDraft}
        selectedBlock={detailsBlock}
        onFocusSelectedBlock={handleFocusSelectedBlock}
        onShowSelectedBlockRevisions={handleShowRevisions}
        onEditSelectedBlock={handleStartEditingBlock}
        onClearSelectedBlock={handleClearSelectedBlock}
        showBlockRevisions={showBlockRevisions}
        onCloseBlockRevisions={handleCloseRevisions}
        loadBlockRevisions={loadBlockRevisions}
        onRevertBlockRevision={handleRevertBlockRevision}
        onPreviewRevision={handlePreviewRevision}
        previewRevisionId={previewRevisionId}
      />

      <div className={`absolute inset-0 transition-all duration-300 ${sidebarOpen ? 'pl-0' : 'pl-0'}`}>
        <MapContainer
          center={farmCenter}
          zoom={11.7}
          blocks={blockFeatures}
          vizSettings={previewVizSettings ?? farm.vizSettings}
          selectedBlockId={selectedBlockId}
          onBlockSelect={handleMapBlockSelect}
          onBlockDoubleClick={handleMapBlockDoubleClick}
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

