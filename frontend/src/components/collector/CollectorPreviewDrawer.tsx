"use client"

import { useEffect, useState } from 'react'
import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'
import { Collector } from '@/types/collector'

const DRAWER_NAME = 'collectorPreview'

interface CollectorDrawerState {
  collectorId?: string
  dataset?: { id: string; name: string }
}

export default function CollectorPreviewDrawer({ farmId }: { farmId: string }) {
  const { drawers, closeDrawer, showAlert } = useUI()
  const state = (drawers[DRAWER_NAME] as CollectorDrawerState | undefined) || {}
  const collectorId = state.collectorId
  const dataset = state.dataset

  const [collector, setCollector] = useState<Collector | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!farmId || !collectorId) {
      return
    }

    let cancelled = false

    const loadCollector = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await apiClient.get(`/api/farms/${farmId}/collectors/${collectorId}`)
        if (!cancelled) {
          setCollector(response.data)
        }
      } catch (err: any) {
        if (!cancelled) {
          const message = err?.response?.data?.message || 'Collector details are not available yet.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadCollector()

    return () => {
      cancelled = true
    }
  }, [collectorId, farmId])

  const handleClose = () => {
    closeDrawer(DRAWER_NAME)
    setCollector(null)
    setError(null)
  }

  const handleLaunchCollector = () => {
    if (!collector) {
      showAlert('Collector not loaded yet.', 'warning')
      return
    }

    window.dispatchEvent(new CustomEvent('launchCollector', { detail: { collector, dataset } }))
    showAlert('Collector launch event dispatched. Wire up listeners in MapContext to complete the feature.', 'info')
  }

  return (
    <Drawer
      isOpen={!!collectorId}
      title={collector?.name || dataset?.name || 'Collector'}
      onClose={handleClose}
      position="left"
      showBackdrop={false}
    >
      {loading ? (
        <div className="py-8 flex flex-col items-center gap-2 text-gray-500">
          <div className="spinner" />
          <p className="text-sm">Loading collector…</p>
        </div>
      ) : error ? (
        <div className="py-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4">
          {error}
        </div>
      ) : !collector ? (
        <div className="py-6 text-sm text-gray-500">
          Select a dataset linked to a collector to preview the form.
        </div>
      ) : (
        <div className="space-y-4 text-sm text-gray-700">
          {collector.description && <p>{collector.description}</p>}

          <div>
            <p className="text-xs uppercase text-gray-500 mb-2">Fields</p>
            <div className="space-y-2">
              {collector.fields.map((field) => (
                <div key={field.machine_name} className="border border-gray-200 rounded-md p-2">
                  <p className="text-sm font-medium">{field.label}</p>
                  <p className="text-xs text-gray-500">{field.type}</p>
                  {field.options?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {field.options.map((option) => (
                        <span
                          key={option}
                          className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleLaunchCollector}
            className="w-full btn btn-primary"
          >
            Launch Collector Workflow
          </button>
        </div>
      )}
    </Drawer>
  )
}



