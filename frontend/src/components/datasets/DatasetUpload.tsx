import { useState, useRef, FormEvent } from 'react'
import { useUI } from '@/context/UIContext'
import { CreateDatasetInput } from '@/types/dataset'

interface DatasetUploadProps {
  farmId: string
  onUpload: (file: File, metadata: CreateDatasetInput) => Promise<void>
  onCancel: () => void
}

export default function DatasetUpload({ farmId, onUpload, onCancel }: DatasetUploadProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showAlert } = useUI()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    const validExtensions = ['.csv', '.geojson', '.json', '.zip', '.kml', '.kmz', '.tif', '.tiff']
    const fileExt = selectedFile.name.toLowerCase().match(/\.[^.]+$/)?.[0]

    if (!fileExt || !validExtensions.includes(fileExt)) {
      showAlert('Invalid file type. Supported: CSV, GeoJSON, Shapefile (ZIP), KML, TIFF', 'error')
      return
    }

    setFile(selectedFile)
    // Auto-fill name if empty
    if (!name) {
      setName(selectedFile.name.replace(/\.[^.]+$/, ''))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!file) {
      showAlert('Please select a file', 'warning')
      return
    }

    if (!name.trim()) {
      showAlert('Please enter a dataset name', 'warning')
      return
    }

    try {
      setLoading(true)
      await onUpload(file, {
        farmId,
        name: name.trim(),
        description: description.trim() || undefined,
      })
      showAlert('Dataset uploaded successfully!', 'success')
    } catch (error: any) {
      showAlert(error.response?.data?.message || 'Failed to upload dataset', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">Upload Dataset</h3>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="label">File *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.geojson,.json,.zip,.kml,.kmz,.tif,.tiff"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 transition-colors"
            >
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-primary-600 mt-2">Click to change file</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-gray-600">Click to select file</p>
                  <p className="text-xs text-gray-500 mt-1">
                    CSV, GeoJSON, Shapefile, KML, or TIFF
                  </p>
                </div>
              )}
            </button>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="dataset-name" className="label">
              Dataset Name *
            </label>
            <input
              id="dataset-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g., Soil Moisture Survey"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="dataset-description" className="label">
              Description
            </label>
            <textarea
              id="dataset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onCancel} disabled={loading} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading || !file} className="btn btn-primary">
              {loading ? (
                <span className="flex items-center">
                  <span className="spinner mr-2"></span>
                  Uploading...
                </span>
              ) : (
                'Upload'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
