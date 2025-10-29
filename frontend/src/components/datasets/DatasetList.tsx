import { Dataset } from '@/types/dataset'

interface DatasetListProps {
  datasets: Dataset[]
  loading?: boolean
  onSelect?: (dataset: Dataset) => void
  onUpload?: () => void
}

export default function DatasetList({ datasets, loading, onSelect, onUpload }: DatasetListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="spinner"></div>
      </div>
    )
  }

  if (datasets.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500 mb-4">No datasets yet</p>
        {onUpload && (
          <button onClick={onUpload} className="btn btn-primary btn-sm">
            Upload Dataset
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {datasets.map((dataset) => (
        <div
          key={dataset.id}
          onClick={() => onSelect?.(dataset)}
          className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 truncate">{dataset.name}</p>
              {dataset.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{dataset.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-400">
                  {dataset.headers.length} fields
                </span>
                {dataset.dynamic && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    Dynamic
                  </span>
                )}
                {dataset.processing?.status === 'processing' && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    Processing...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
