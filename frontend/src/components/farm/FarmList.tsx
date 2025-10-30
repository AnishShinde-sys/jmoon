"use client"

import { useRouter } from 'next/navigation'

import { Farm } from '@/types/farm'

interface FarmListProps {
  farms: Farm[]
  loading?: boolean
  onCreateFarm?: () => void
}

export default function FarmList({ farms, loading, onCreateFarm }: FarmListProps) {
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner"></div>
      </div>
    )
  }

  if (farms.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <div className="text-6xl mb-4">🌾</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Farms Yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first farm to start managing your agricultural data
          </p>
          {onCreateFarm && (
            <button onClick={onCreateFarm} className="btn btn-primary">
              Create Your First Farm
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {farms.map((farm) => (
        <div
          key={farm.id}
          onClick={() => router.push(`/farm/${farm.id}`)}
          className="card cursor-pointer hover:shadow-xl transition-shadow duration-200"
        >
          <div className="card-body">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{farm.name}</h3>
              <span className="text-2xl">🌾</span>
            </div>

            {farm.description && (
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{farm.description}</p>
            )}

            {farm.geolocation && (
              <div className="text-xs text-gray-500 mb-2">
                📍 {farm.geolocation.latitude.toFixed(4)}, {farm.geolocation.longitude.toFixed(4)}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <span className="text-xs text-gray-400">
                Updated {new Date(farm.updatedAt).toLocaleDateString()}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/farm/${farm.id}`)
                }}
                className="text-primary-600 text-xs hover:text-primary-700"
              >
                View →
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
