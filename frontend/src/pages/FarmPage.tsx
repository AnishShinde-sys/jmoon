import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUI } from '@/context/UIContext'
import { useMapContext } from '@/context/MapContext'
import { useBlocks } from '@/hooks/useBlocks'
import { Farm } from '@/types/farm'
import apiClient from '@/lib/apiClient'
import MapContainer from '@/components/map/MapContainer'
import CreateBlockDrawer from '@/components/blocks/CreateBlockDrawer'
import BlockDetailsDrawer from '@/components/blocks/BlockDetailsDrawer'
import DatasetDrawer from '@/components/datasets/DatasetDrawer'
import PluginsDrawer from '@/components/plugins/PluginsDrawer'
import FarmDetailsDrawer from '@/components/farm/FarmDetailsDrawer'
import FarmSettingsDrawer from '@/components/farm/FarmSettingsDrawer'
import CollaboratorsDrawer from '@/components/farm/CollaboratorsDrawer'
import DrawingToolbar from '@/components/map/DrawingToolbar'
import FarmSidebar from '@/components/farm/FarmSidebar'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
// @ts-ignore - turf module resolution issue
import * as turf from '@turf/turf'

export default function FarmPage() {
  const { farmId } = useParams<{
    farmId: string
  }>()
  const navigate = useNavigate()
  const { showAlert, openDrawer, closeDrawer, drawers } = useUI()
  const { map, draw } = useMapContext()
  
  // Use blocks hook for better state management
  const { blocksGeoJSON: blocksJSONFromHook } = useBlocks(farmId || '')
  const [blocksGeoJSON, setBlocksGeoJSON] = useState<any[]>([])

  const [farm, setFarm] = useState<Farm | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  useEffect(() => {
    if (farmId) {
      loadFarm()
    }
  }, [farmId])
  
  // Load blocks whenever they change
  useEffect(() => {
    if (blocksJSONFromHook) {
      setBlocksGeoJSON(blocksJSONFromHook.features || [])
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
        // When polygon is completed (double-click), reopen the create block drawer
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
    // If there's a drawing, just exit draw mode to allow selection/editing
    setIsDrawing(false)
    draw.changeMode('simple_select')
  }

  const loadFarm = async () => {
    try {
      const response = await apiClient.get(`/api/farms/${farmId}`)
      const farmData = response.data
      
      // Initialize default viz settings if they don't exist
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
      showAlert(error.response?.data?.message || 'Failed to load farm', 'error')
      navigate('/dashboard')
    }
  }
  
  // Load blocks whenever they change from the hook
  useEffect(() => {
    if (blocksJSONFromHook && blocksJSONFromHook.features) {
      setBlocksGeoJSON(blocksJSONFromHook.features)
    } else {
      setBlocksGeoJSON([])
    }
  }, [blocksJSONFromHook])



  const handleBlockClick = (blockId: string) => {
    // Highlight the clicked block
    setSelectedBlockId(blockId)
    
    closeDrawer('farmDetails')
    setTimeout(() => {
      openDrawer('blockDetails', blockId)
    }, 100)

    // Fly to the selected block
    if (map && blocksGeoJSON.length > 0) {
      const blockFeature = blocksGeoJSON.find((b: any) => {
        const id = b.id || b.properties?.id
        return id === blockId
      })
      if (blockFeature && (blockFeature as any).geometry) {
        try {
          const bbox = turf.bbox(blockFeature as any)
          map.fitBounds(bbox as [number, number, number, number], { padding: 100, duration: 1000 })
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
      // Update farm in backend using PUT (not PATCH)
      const response = await apiClient.put(`/api/farms/${farmId}`, {
        name: updatedFarm.name,
        description: updatedFarm.description,
      })
      // Update local state with the response from backend
      setFarm(response.data)
      showAlert('Farm settings updated successfully', 'success')
      closeDrawer('farmSettings')
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to update farm settings', 'error')
    }
  }

  const handleShowCollaborators = () => {
    openDrawer('collaborators')
  }

  const handleVizUpdate = (settings: Farm['vizSettings']) => {
    if (!farm) return
    // Update local state immediately for smooth UX
    setFarm({ ...farm, vizSettings: settings })
    // Backend persistence will be added when endpoint is implemented
  }

  if (!farm) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex relative overflow-hidden">
      <CreateBlockDrawer />
      <BlockDetailsDrawer />
      <DatasetDrawer />
      <PluginsDrawer />
      <FarmDetailsDrawer />
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
      
      {/* New Farm Sidebar */}
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

      {/* Map Area */}
      <div className={`absolute inset-0 transition-all duration-300 ${sidebarOpen ? 'pl-0' : 'pl-0'}`}>
        <MapContainer
          center={farm?.geolocation ? [farm.geolocation.longitude, farm.geolocation.latitude] as [number, number] : undefined}
          zoom={13}
          enableDrawing={true}
          blocks={blocksGeoJSON}
          onBlockClick={handleBlockClick}
          vizSettings={farm.vizSettings}
          selectedBlockId={selectedBlockId}
        >
          {/* Drawing Toolbar */}
          <DrawingToolbar
            onStartDrawing={startDrawing}
            onClear={clearDrawing}
            onFinish={finishDrawing}
            isDrawing={isDrawing}
            hasDrawing={hasDrawing}
          />
        </MapContainer>
        
        {/* Sidebar Toggle Button - Floating semicircle on left edge */}
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
