"use client"

import { useCallback, useEffect, useState } from 'react'
import { MapPinIcon, CheckIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import { useAuth } from '@/context/AuthContext'
import apiClient from '@/lib/apiClient'
import { Collector, CollectorField, CreateDataPointInput } from '@/types/collector'
import { Dataset } from '@/types/dataset'

const DRAWER_NAME = 'collector'

interface CollectorDrawerState {
  collector?: Collector
  farmId?: string
  dataset?: { id: string; name: string }
}

interface CollectorFormDrawerProps {}

export default function CollectorFormDrawer({}: CollectorFormDrawerProps) {
  const { drawers, closeDrawer, showAlert } = useUI()
  const { user } = useAuth()

  const [collector, setCollector] = useState<Collector | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const drawerState = drawers[DRAWER_NAME] as CollectorDrawerState | undefined
  const isOpen = Boolean(drawerState)
  const farmId = drawerState?.farmId
  const linkedDataset = drawerState?.dataset

  useEffect(() => {
    if (isOpen && drawerState?.collector) {
      const collectorData = drawerState.collector as Collector
      setCollector(collectorData)
      
      // Initialize form data with empty values
      const initialData: Record<string, any> = {}
      collectorData.fields.forEach((field) => {
        initialData[field.machine_name] = field.type === 'Number' ? 0 : ''
      })
      setFormData(initialData)
    } else {
      setCollector(null)
      setFormData({})
      setLocation(null)
      setLocationAccuracy(null)
    }
  }, [isOpen, drawerState])

  // Get user location
  useEffect(() => {
    if (!isOpen) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationAccuracy(position.coords.accuracy)
      },
      (error) => {
        console.warn('Geolocation error:', error)
        setLocationAccuracy(null)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [isOpen])

  const groupedFields = useCallback(() => {
    if (!collector) return {}

    const groups: Record<string, CollectorField[]> = { Others: [] }
    
    collector.fields.forEach((field) => {
      const group = (field as any).group || 'Others'
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push(field)
    })

    return groups
  }, [collector])

  const handleFieldChange = (machineName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [machineName]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collector || !farmId || !location) return

    setLoading(true)

    try {
      const input: CreateDataPointInput = {
        collectorId: collector.id,
        geolocation: location,
        ...formData,
      }

      await apiClient.post(`/api/farms/${farmId}/collectors/${collector.id}/datapoints`, input)
      showAlert('Data point saved successfully', 'success')

      if (linkedDataset) {
        try {
          showAlert(`Refreshing “${linkedDataset.name}” with the latest readings…`, 'info')
          const rebuildResponse = await apiClient.post(`/api/farms/${farmId}/datasets/${linkedDataset.id}/rebuild`)
          const rebuiltDataset = rebuildResponse.data as Dataset
          window.dispatchEvent(new CustomEvent('datasetRecompiled', { detail: { dataset: rebuiltDataset } }))
          window.dispatchEvent(new CustomEvent('datasets:refresh', { detail: { farmId } }))
          window.dispatchEvent(new CustomEvent('collectors:refresh', { detail: { farmId } }))
          showAlert(`“${linkedDataset.name}” is up to date with the newest data points.`, 'success')
        } catch (rebuildError: any) {
          const message = rebuildError?.response?.data?.message || 'Dataset rebuild failed'
          showAlert(message, 'warning')
        }
      }
      
      // Reset form
      const resetData: Record<string, any> = {}
      collector.fields.forEach((field) => {
        resetData[field.machine_name] = field.type === 'Number' ? 0 : ''
      })
      setFormData(resetData)
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to save data point'
      showAlert(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const renderField = (field: CollectorField) => {
    const value = formData[field.machine_name] ?? (field.type === 'Number' ? 0 : '')

    switch (field.type) {
      case 'Text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.machine_name, e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        )

      case 'Number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.machine_name, Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        )

      case 'Select':
        return (
          <div className="mt-1 space-y-2">
            {(field.options || []).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={field.machine_name}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleFieldChange(field.machine_name, e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                {option}
              </label>
            ))}
          </div>
        )

      case 'Date and Time':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleFieldChange(field.machine_name, e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        )

      case 'Image':
        return (
          <div className="mt-1">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  // For now, just store the file name
                  // In production, you'd upload to storage and store the URL
                  handleFieldChange(field.machine_name, file.name)
                }
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">Image upload integration pending</p>
          </div>
        )

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.machine_name, e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        )
    }
  }

  const getLocationStatus = () => {
    if (!locationAccuracy) return { text: 'No GPS Signal', color: 'text-red-600' }
    if (locationAccuracy > 5) return { text: `GPS Accuracy: ${locationAccuracy}M (Bad)`, color: 'text-red-600' }
    if (locationAccuracy > 3) return { text: `GPS Accuracy: ${locationAccuracy}M (Ok)`, color: 'text-yellow-600' }
    return { text: `GPS Accuracy: ${locationAccuracy}M (Good)`, color: 'text-green-600' }
  }

  const locationStatus = getLocationStatus()

  return (
    <Drawer
      isOpen={isOpen}
      title={collector?.name || 'Data Collector'}
      onClose={() => closeDrawer(DRAWER_NAME)}
      position="left"
      showBackdrop={false}
    >
      {!collector ? (
        <div className="py-8 text-center text-sm text-gray-500">
          Select a collector to start gathering data.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {collector.description && (
            <p className="text-sm text-gray-600">{collector.description}</p>
          )}

          {linkedDataset && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <p className="font-semibold text-blue-900">Linked Dataset</p>
              <p className="mt-1 text-blue-700/80">
                Data points will automatically rebuild “{linkedDataset.name}”.
              </p>
            </div>
          )}
 
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2 text-xs">
              <MapPinIcon className="h-4 w-4" />
              <span className={locationStatus.color}>{locationStatus.text}</span>
            </div>
            {location && (
              <p className="mt-1 text-xs text-gray-500">
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </p>
            )}
          </div>

          <div className="space-y-4">
            {Object.entries(groupedFields()).map(([groupName, groupFields]) => (
              <div key={groupName}>
                {groupName !== 'Others' && (
                  <h4 className="border-b border-gray-200 pb-1 text-sm font-semibold text-gray-800">
                    {groupName}
                  </h4>
                )}
                <div className="space-y-4">
                  {groupFields.map((field) => (
                    <div key={field.machine_name}>
                      <label className="block text-sm font-medium text-gray-700">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <button
              type="submit"
              disabled={loading || !location}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              <CheckIcon className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Data Point'}
            </button>
            {!location && (
              <p className="mt-2 text-xs text-center text-red-600">
                GPS location required to save data point
              </p>
            )}
          </div>
        </form>
      )}
    </Drawer>
  )
}
