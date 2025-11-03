"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUI } from '@/context/UIContext'
import { useUserProfile } from '@/context/UserProfileContext'
import { Farm } from '@/types/farm'
import Drawer from '../ui/Drawer'
import { MapIcon, ChartBarIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import apiClient from '@/lib/apiClient'
import { formatArea } from '@/lib/utils'

const DRAWER_NAME = 'farmDetails'

interface FarmDetailsDrawerProps {
  farmId: string
}

export default function FarmDetailsDrawer({ farmId }: FarmDetailsDrawerProps) {
  const router = useRouter()
  const { drawers, closeDrawer, openDrawer } = useUI()
  const { profile } = useUserProfile()
  const [farm, setFarm] = useState<Farm | null>(null)

  const measurementSystem = profile?.measurementSystem ?? 'Metric'

  useEffect(() => {
    if (!drawers[DRAWER_NAME] || !farmId) return

    let isCancelled = false

    apiClient
      .get(`/api/farms/${farmId}`)
      .then((response) => {
        if (!isCancelled) {
          setFarm(response.data)
        }
      })
      .catch((error) => {
        console.error('Failed to load farm:', error)
      })

    return () => {
      isCancelled = true
    }
  }, [drawers[DRAWER_NAME], farmId])

  const handleAction = (action: string) => {
    closeDrawer(DRAWER_NAME)
    switch (action) {
      case 'datasets':
        openDrawer('datasets')
        break
      case 'plugins':
        openDrawer('plugins')
        break
      case 'collaborators':
        openDrawer('collaborators')
        break
      case 'blocks':
        openDrawer('blocks')
        break
      default:
        break
    }
  }

  return (
    <Drawer 
      isOpen={drawers[DRAWER_NAME] || false} 
      title={farm?.name || 'Farm Details'}
      onClose={() => closeDrawer(DRAWER_NAME)} 
      position="right"
      showBackdrop={false}
    >
      <div className="space-y-4">
        {/* Farm Description */}
        {farm?.description && (
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-700">{farm.description}</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-2">
          <button
            onClick={() => handleAction('datasets')}
            className="w-full p-3 border border-gray-200 rounded-md hover:bg-gray-50 text-left flex items-center gap-3"
          >
            <MapIcon className="w-5 h-5 text-primary-600" />
            <div>
              <p className="font-medium text-sm">Datasets</p>
              <p className="text-xs text-gray-500">View and manage datasets</p>
            </div>
          </button>

          <button
            onClick={() => handleAction('plugins')}
            className="w-full p-3 border border-gray-200 rounded-md hover:bg-gray-50 text-left flex items-center gap-3"
          >
            <ChartBarIcon className="w-5 h-5 text-primary-600" />
            <div>
              <p className="font-medium text-sm">Plugins</p>
              <p className="text-xs text-gray-500">Use analysis tools</p>
            </div>
          </button>

          <button
            onClick={() => handleAction('blocks')}
            className="w-full p-3 border border-gray-200 rounded-md hover:bg-gray-50 text-left flex items-center gap-3"
          >
            <ChartBarIcon className="w-5 h-5 text-primary-600" />
            <div>
              <p className="font-medium text-sm">Blocks</p>
              <p className="text-xs text-gray-500">Manage field blocks</p>
            </div>
          </button>

          <button
            onClick={() => handleAction('collaborators')}
            className="w-full p-3 border border-gray-200 rounded-md hover:bg-gray-50 text-left flex items-center gap-3"
          >
            <UserGroupIcon className="w-5 h-5 text-primary-600" />
            <div>
              <p className="font-medium text-sm">Collaborators</p>
              <p className="text-xs text-gray-500">Manage team members</p>
            </div>
          </button>
        </div>

        {/* Farm Stats */}
        {farm && (
          <div className="pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Area</p>
                <p className="text-sm font-medium">
                  {formatArea(farm.totalArea ?? null, measurementSystem)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Blocks</p>
                <p className="text-sm font-medium">{farm.blockCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Datasets</p>
                <p className="text-sm font-medium">{farm.datasetCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Updated</p>
                <p className="text-sm font-medium">
                  {new Date(farm.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}





