import { useState, useRef, useMemo } from 'react'
import Papa from 'papaparse'
import { useUI } from '@/context/UIContext'
import { CreateDatasetInput, DatasetColumnMapping, DatasetFolder, DatasetType } from '@/types/dataset'

type UploadStep = 'select' | 'mapping' | 'review'

const SUPPORTED_TYPES: Array<{ label: string; value: DatasetType }> = [
  { label: 'CSV / Tabular', value: 'csv' },
  { label: 'GeoJSON', value: 'geojson' },
  { label: 'Shapefile (ZIP)', value: 'shapefile' },
  { label: 'KML', value: 'kml' },
  { label: 'Raster (TIFF)', value: 'tiff' },
]

interface DatasetUploadProps {
  farmId: string
  folders: DatasetFolder[]
  currentFolderId: string
  onUpload: (file: File, metadata: CreateDatasetInput) => Promise<void>
  onCancel: () => void
}

export default function DatasetUpload({ farmId, folders, currentFolderId, onUpload, onCancel }: DatasetUploadProps) {
  const [step, setStep] = useState<UploadStep>('select')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [datasetType, setDatasetType] = useState<DatasetType>('csv')
  const [targetFolderId, setTargetFolderId] = useState<string>(currentFolderId || 'root')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<DatasetColumnMapping>({})
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showAlert } = useUI()

  const availableFolders = useMemo(() => {
    const root: DatasetFolder = {
      id: 'root',
      farmId,
      name: 'All Datasets',
      parentId: 'root',
      createdAt: '',
      updatedAt: '',
    }
    return [root, ...folders]
  }, [folders, farmId])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const validExtensions = ['.csv', '.geojson', '.json', '.zip', '.kml', '.kmz', '.tif', '.tiff']
    const fileExt = selectedFile.name.toLowerCase().match(/\.[^.]+$/)?.[0]

    if (!fileExt || !validExtensions.includes(fileExt)) {
      showAlert('Invalid file type. Supported: CSV, GeoJSON, Shapefile (ZIP), KML, TIFF', 'error')
      return
    }

    setFile(selectedFile)
    if (!name) {
      setName(selectedFile.name.replace(/\.[^.]+$/, ''))
    }

    setColumnMapping({})

    if (fileExt === '.csv' || fileExt === '.json' || fileExt === '.geojson') {
      Papa.parse(selectedFile, {
        header: true,
        preview: 50,
        skipEmptyLines: true,
        complete: (results) => {
          const detectedHeaders: string[] = Array.isArray(results.meta.fields)
            ? (results.meta.fields as string[])
            : []
          setHeaders(detectedHeaders)
          setPreviewRows(
            (results.data as Record<string, any>[])?.filter((row) => Object.keys(row).length > 0).slice(0, 5)
          )
        },
        error: () => {
          showAlert('Unable to preview file contents. Column mapping will be manual.', 'warning')
        },
      })
    } else {
      setHeaders([])
      setPreviewRows([])
    }
  }

  const handleNext = () => {
    if (!file) {
      showAlert('Please select a file to continue', 'warning')
      return
    }

    if (!name.trim()) {
      showAlert('Please provide a dataset name', 'warning')
      return
    }

    if (step === 'select') {
      setStep('mapping')
    } else if (step === 'mapping') {
      setStep('review')
    }
  }

  const handleBack = () => {
    if (step === 'mapping') {
      setStep('select')
    } else if (step === 'review') {
      setStep('mapping')
    }
  }

  const handleSubmit = async () => {
    if (!file) return

    try {
      setLoading(true)
      await onUpload(file, {
        farmId,
        name: name.trim(),
        description: description.trim() || undefined,
        folderId: targetFolderId === 'root' ? undefined : targetFolderId,
        type: datasetType,
        columnMapping: Object.keys(columnMapping).length > 0 ? columnMapping : undefined,
        originalHeaders: headers.length > 0 ? headers : undefined,
      })
      showAlert('Dataset upload started. You will be notified when processing finishes.', 'success')
      onCancel()
    } catch (error: any) {
      showAlert(error?.response?.data?.message || 'Failed to upload dataset', 'error')
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    if (step === 'select') {
      return (
        <>
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
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p className="text-xs text-primary-600 mt-2">Click to change file</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-gray-600">Click to select a dataset file</p>
                  <p className="text-xs text-gray-500 mt-1">CSV, GeoJSON, Shapefile (ZIP), KML, or TIFF</p>
                </div>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dataset-name" className="label">
                Dataset Name *
              </label>
              <input
                id="dataset-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g., Soil Moisture Survey"
              />
            </div>
            <div>
              <label className="label">Dataset Type</label>
              <select
                value={datasetType}
                onChange={(e) => setDatasetType(e.target.value as DatasetType)}
                className="input"
              >
                {SUPPORTED_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="label">Folder</label>
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className="input"
            >
              {availableFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )
    }

    if (step === 'mapping') {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Column Mapping</h4>
            <p className="text-xs text-gray-500">
              Map the columns in your file to standard fields so Budbase can interpret the data.
            </p>
          </div>

          {headers.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              Column mapping isn’t available for this file type. You can continue without mapping.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['latitude', 'longitude', 'value', 'timestamp'].map((field) => (
                <div key={field}>
                  <label className="label capitalize">{field}</label>
                  <select
                    value={columnMapping[field] || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        [field]: e.target.value || undefined,
                      }))
                    }
                    className="input"
                  >
                    <option value="">Not mapped</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                Sample Rows
              </div>
              <div className="max-h-48 overflow-auto text-xs">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="px-2 py-1 text-left font-medium text-gray-600">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {previewRows.map((row, index) => (
                      <tr key={index}>
                        {headers.map((header) => (
                          <td key={`${header}-${index}`} className="px-2 py-1 text-gray-700">
                            {String(row?.[header] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Review</h4>
          <p className="text-xs text-gray-500">
            Confirm the upload configuration before starting the import.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
          <div className="flex justify-between"><span className="font-medium">File</span><span>{file?.name}</span></div>
          <div className="flex justify-between"><span className="font-medium">Dataset Name</span><span>{name}</span></div>
          <div className="flex justify-between"><span className="font-medium">Type</span><span>{datasetType}</span></div>
          <div className="flex justify-between"><span className="font-medium">Folder</span><span>{availableFolders.find((f) => f.id === targetFolderId)?.name || 'All Datasets'}</span></div>
          {description && (
            <div>
              <span className="font-medium">Description</span>
              <p className="mt-1 text-gray-600 text-xs">{description}</p>
            </div>
          )}
        </div>

        {headers.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
            <h5 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Column Mapping</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {Object.entries(columnMapping).map(([key, value]) => (
                value ? (
                  <div key={key} className="flex justify-between">
                    <span className="font-medium text-gray-700">{key}</span>
                    <span className="text-gray-600">{value}</span>
                  </div>
                ) : null
              ))}
              {Object.values(columnMapping).filter(Boolean).length === 0 && (
                <p className="text-gray-500">No columns mapped.</p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Upload Dataset</h3>
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {renderStep()}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="text-xs text-gray-500">
            Step {step === 'select' ? 1 : step === 'mapping' ? 2 : 3} of 3
          </div>
          <div className="flex items-center gap-2">
            {step !== 'select' && (
              <button onClick={handleBack} className="btn btn-secondary btn-sm" disabled={loading}>
                Back
              </button>
            )}
            {step === 'review' ? (
              <button
                onClick={handleSubmit}
                className="btn btn-primary btn-sm"
                disabled={loading}
              >
                {loading ? 'Uploading…' : 'Start Upload'}
              </button>
            ) : (
              <button onClick={handleNext} className="btn btn-primary btn-sm">
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
