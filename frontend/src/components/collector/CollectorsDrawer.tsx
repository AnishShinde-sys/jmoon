"use client"

import { useCallback, useEffect, useState } from 'react'
import { PlusIcon, WrenchScrewdriverIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import { useAuth } from '@/context/AuthContext'
import apiClient from '@/lib/apiClient'
import { Collector } from '@/types/collector'

const DRAWER_NAME = 'collectors'

interface CollectorsDrawerProps {
  farmId: string
  farmOwnerId?: string
}

export default function CollectorsDrawer({ farmId, farmOwnerId }: CollectorsDrawerProps) {
  const { drawers, closeDrawer, openDrawer, showAlert } = useUI()
  const { user } = useAuth()

  const [collectors, setCollectors] = useState<Collector[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)

  const isOpen = Boolean(drawers[DRAWER_NAME])
  const canManage = Boolean(user && farmOwnerId && user.id === farmOwnerId)

  const fetchCollectors = useCallback(async () => {
    if (!farmId) return
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.get<Collector[]>(`/api/farms/${farmId}/collectors`)
      setCollectors(response.data || [])
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to load collectors'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [farmId])

  useEffect(() => {
    if (isOpen) {
      fetchCollectors()
    }
  }, [isOpen, fetchCollectors])

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ farmId?: string }>).detail
      if (!detail?.farmId || detail.farmId === farmId) {
        fetchCollectors()
      }
    }

    window.addEventListener('collectors:refresh', handleRefresh as EventListener)
    return () => {
      window.removeEventListener('collectors:refresh', handleRefresh as EventListener)
    }
  }, [farmId, fetchCollectors])

  const handleCreateCollector = () => {
    openDrawer('createCollector', { farmId })
  }

  const handleEditCollector = (collector: Collector) => {
    openDrawer('createCollector', { farmId, collector, editMode: true })
  }

  const handleCollect = (collector: Collector) => {
    openDrawer('collector', { collector, farmId })
  }

  return (
    <Drawer
      isOpen={isOpen}
      title="Data Collectors"
      onClose={() => closeDrawer(DRAWER_NAME)}
      position="left"
      showBackdrop={false}
    >
      <div className="space-y-4">
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateCollector}
              className="btn btn-primary flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              New Data Collector
            </button>
            <button
              onClick={() => setEditMode(!editMode)}
              className={`btn ${editMode ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
            >
              <WrenchScrewdriverIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-gray-500">
            <div className="spinner" />
            Loading collectors…
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : collectors.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">No data collectors yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first collector to start gathering field data</p>
          </div>
        ) : (
          <div className="space-y-3">
            {collectors.map((collector) => (
              <div
                key={collector.id}
                className="rounded-md border border-gray-200 bg-white p-4 transition hover:border-primary-200 hover:bg-primary-50/30"
              >
                <div
                  className="cursor-pointer"
                  onClick={() => handleCollect(collector)}
                >
                  <p className="text-sm font-semibold text-gray-900">{collector.name}</p>
                  {collector.description && (
                    <p className="mt-1 text-xs text-gray-600">{collector.description}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    {collector.fields.length} field{collector.fields.length !== 1 ? 's' : ''}
                  </p>
                  {collector.reCompile && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      <ArrowPathIcon className="h-3 w-3" /> Needs rebuild
                    </span>
                  )}
                </div>
                {editMode && canManage && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => handleEditCollector(collector)}
                      className="btn btn-secondary btn-sm flex items-center gap-2"
                    >
                      <WrenchScrewdriverIcon className="h-3 w-3" />
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  )
}
