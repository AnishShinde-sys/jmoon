"use client"

import { useCallback, useEffect, useState } from 'react'
import { PencilIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import { useAuth } from '@/context/AuthContext'
import apiClient from '@/lib/apiClient'
import { Collector, DataPoint } from '@/types/collector'

const DRAWER_NAME = 'dataPointDetails'

interface DataPointDetailsDrawerProps {
  farmId: string
}

export default function DataPointDetailsDrawer({ farmId }: DataPointDetailsDrawerProps) {
  const { drawers, closeDrawer, openDrawer, showAlert } = useUI()
  const { user } = useAuth()

  const [dataPoint, setDataPoint] = useState<DataPoint | null>(null)
  const [collector, setCollector] = useState<Collector | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const drawerState = drawers[DRAWER_NAME] as any
  const isOpen = Boolean(drawerState)
  const dataPointId = drawerState?.dataPointId
  const collectorId = drawerState?.collectorId

  const loadDataPoint = useCallback(async () => {
    if (!farmId || !collectorId || !dataPointId) return

    setLoading(true)
    setError(null)

    try {
      const [dataPointRes, collectorRes] = await Promise.all([
        apiClient.get<DataPoint>(`/api/farms/${farmId}/collectors/${collectorId}/datapoints/${dataPointId}`),
        apiClient.get<Collector>(`/api/farms/${farmId}/collectors/${collectorId}`),
      ])

      setDataPoint(dataPointRes.data)
      setCollector(collectorRes.data)
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to load data point details'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [farmId, collectorId, dataPointId])

  useEffect(() => {
    if (isOpen) {
      loadDataPoint()
    } else {
      setDataPoint(null)
      setCollector(null)
      setError(null)
    }
  }, [isOpen, loadDataPoint])

  const handleEdit = () => {
    if (!dataPoint || !collector) return
    openDrawer('editDataPoint', { dataPoint, collector, farmId })
  }

  const handleViewRevisions = () => {
    if (!dataPoint) return
    openDrawer('dataPointRevisions', { dataPointId: dataPoint.id, collectorId, farmId })
  }

  const groupedFields = useCallback(() => {
    if (!collector) return {}

    const groups: Record<string, Array<{ field: CollectorField; value: any }>> = { Others: [] }
    
    collector.fields.forEach((field) => {
      const group = (field as any).group || 'Others'
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push({
        field,
        value: dataPoint?.[field.machine_name],
      })
    })

    return groups
  }, [collector, dataPoint])

  const isImageUrl = (value: string, label: string): boolean => {
    if (!value || typeof value !== 'string') return false
    return value.includes('http') && (
      value.includes('.jpg') || 
      value.includes('.jpeg') || 
      value.includes('.png') || 
      value.includes('.gif') ||
      label.toLowerCase().includes('image') ||
      label.toLowerCase().includes('photo')
    )
  }

  const canEdit = Boolean(
    user && 
    collector && 
    (collector.createdBy === user.id || (collector as any).editors?.includes(user.id))
  )

  return (
    <Drawer
      isOpen={isOpen}
      title="Data Point Details"
      onClose={() => closeDrawer(DRAWER_NAME)}
      position="right"
      showBackdrop={false}
    >
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-gray-500">
          <div className="spinner" />
          Loading data point…
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !dataPoint || !collector ? (
        <div className="py-8 text-center text-sm text-gray-500">
          Click on a data point to view its details.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Location Info */}
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <MapPinIcon className="h-4 w-4" />
              Location
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {dataPoint.geolocation.latitude.toFixed(6)}, {dataPoint.geolocation.longitude.toFixed(6)}
            </p>
            <p className="text-xs text-gray-500">
              Created: {new Date(dataPoint.createdAt).toLocaleString()}
            </p>
            {dataPoint.updatedAt !== dataPoint.createdAt && (
              <p className="text-xs text-gray-500">
                Updated: {new Date(dataPoint.updatedAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* Field Data */}
          <div className="space-y-4">
            {Object.entries(groupedFields()).map(([groupName, groupFields]) => (
              <div key={groupName}>
                {groupName !== 'Others' && (
                  <h4 className="border-b border-gray-200 pb-1 text-sm font-semibold text-gray-800">
                    {groupName}
                  </h4>
                )}
                <div className="space-y-3">
                  {groupFields.map(({ field, value }) => {
                    if (!value && value !== 0) return null

                    return (
                      <div key={field.machine_name}>
                        <p className="text-sm">
                          <span className="font-medium text-gray-700">{field.label}:</span>{' '}
                          {field.type === 'Image' && isImageUrl(value, field.label) ? (
                            <div className="mt-2">
                              <img
                                src={value}
                                alt={field.label}
                                className="max-h-48 rounded-md border border-gray-200"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                <a
                                  href={value}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-700"
                                >
                                  View full image ↗
                                </a>
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-900">{String(value)}</span>
                          )}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <button
                onClick={handleEdit}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <PencilIcon className="h-4 w-4" />
                Edit Data Point
              </button>
              <button
                onClick={handleViewRevisions}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <ClockIcon className="h-4 w-4" />
                View Revisions
              </button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
