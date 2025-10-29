import { Farm } from '@/types/farm'

interface FarmDetailsProps {
  farm: Farm
  onEdit?: () => void
  onDelete?: () => void
}

export default function FarmDetails({ farm, onEdit, onDelete }: FarmDetailsProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Farm Details</h2>
          <div className="flex gap-2">
            {onEdit && (
              <button onClick={onEdit} className="text-sm text-primary-600 hover:text-primary-700">
                Edit
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="text-sm text-red-600 hover:text-red-700">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card-body space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
          <p className="text-sm text-gray-900 mt-1">{farm.name}</p>
        </div>

        {farm.description && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Description</label>
            <p className="text-sm text-gray-900 mt-1">{farm.description}</p>
          </div>
        )}

        {farm.geolocation && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Location</label>
            <p className="text-sm text-gray-900 mt-1">
              {farm.geolocation.latitude.toFixed(6)}, {farm.geolocation.longitude.toFixed(6)}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Created</label>
            <p className="text-sm text-gray-900 mt-1">
              {new Date(farm.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Last Updated</label>
            <p className="text-sm text-gray-900 mt-1">
              {new Date(farm.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
