"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  FolderPlusIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline'
import { useUI } from '@/context/UIContext'
import { CreateDatasetInput, Dataset, DatasetFolder } from '@/types/dataset'
import Drawer from '../ui/Drawer'
import DatasetLaunchConfirmModal, { LaunchOptions } from './DatasetLaunchConfirmModal'
import DatasetUpload from './DatasetUpload'
import { useDatasetFolders } from '@/hooks/useDatasetFolders'
import { useDatasets } from '@/hooks/useDatasets'
import apiClient from '@/lib/apiClient'

const DRAWER_NAME = 'datasets'

interface DatasetDrawerProps {
  farmId: string
}

export default function DatasetDrawer({ farmId }: DatasetDrawerProps) {
  const { drawers, closeDrawer, openDrawer, showAlert } = useUI()
  const [currentFolderId, setCurrentFolderId] = useState<string>('root')
  const [showUpload, setShowUpload] = useState(false)
  const [pendingDataset, setPendingDataset] = useState<Dataset | null>(null)

  const {
    folders,
    loading: foldersLoading,
    refetch: refetchFolders,
  } = useDatasetFolders(farmId)

  const {
    datasets,
    loading,
    refetch,
    uploadDataset,
  } = useDatasets(farmId, currentFolderId)

  useEffect(() => {
    if (drawers[DRAWER_NAME]) {
      refetch()
      refetchFolders()
    }
  }, [drawers[DRAWER_NAME], refetch, refetchFolders])

  useEffect(() => {
    if (!drawers[DRAWER_NAME]) {
      setShowUpload(false)
    }
  }, [drawers[DRAWER_NAME]])

  const breadcrumbs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; parentId: string }>()
    folders.forEach((folder) => map.set(folder.id, folder))

    const trail: Array<{ id: string; name: string }> = []

    let pointer: string | undefined = currentFolderId
    while (pointer && pointer !== 'root') {
      const folder = map.get(pointer)
      if (!folder) break
      trail.unshift({ id: folder.id, name: folder.name })
      pointer = folder.parentId
    }

    trail.unshift({ id: 'root', name: 'All Datasets' })
    return trail
  }, [currentFolderId, folders])

  const childFolders = useMemo(() => {
    if (currentFolderId === 'root') {
      return folders.filter((folder) => folder.parentId === 'root')
    }
    return folders.filter((folder) => folder.parentId === currentFolderId)
  }, [currentFolderId, folders])

  const handleCreateFolder = async () => {
    const name = prompt('Folder name')
    if (!name || !name.trim()) {
      return
    }

    try {
      const response = await apiClient.post<DatasetFolder>(`/api/farms/${farmId}/dataset-folders`, {
        name: name.trim(),
        parentId: currentFolderId,
      })
      await refetchFolders()
      const newFolderId = response.data?.id
      if (newFolderId) {
        setCurrentFolderId(newFolderId)
      }
      showAlert(`Folder “${name.trim()}” created.`, 'success')
    } catch (error: any) {
      showAlert(error?.response?.data?.message || 'Failed to create folder', 'error')
    }
  }

  const handleLaunchDataset = (dataset: Dataset) => {
    setPendingDataset(dataset)
  }

  const handleConfirmLaunch = useCallback(
    (launchOptions: LaunchOptions, datasetOverride?: Dataset) => {
      const datasetToLaunch = datasetOverride || pendingDataset
      if (!datasetToLaunch) return

      window.dispatchEvent(
        new CustomEvent('launchDataset', {
          detail: {
            dataset: datasetToLaunch,
            options: launchOptions,
          },
        })
      )

      if (launchOptions.clearExistingLayers) {
        window.dispatchEvent(
          new CustomEvent('clearDatasetLayers', {
            detail: { datasetId: datasetToLaunch.id },
          })
        )
      }

      showAlert(`Launching “${datasetToLaunch.name}” on the map.`, 'success')

      if (launchOptions.openDetails) {
        openDrawer('datasetDetails', datasetToLaunch)
      }

      setPendingDataset(null)
      closeDrawer(DRAWER_NAME)
    },
    [closeDrawer, openDrawer, pendingDataset, showAlert]
  )

  const handleCancelLaunch = useCallback(() => {
    setPendingDataset(null)
  }, [])

  const handleUploadComplete = async (file: File, metadata: CreateDatasetInput) => {
    await uploadDataset(file, metadata)
    await refetch()
    setShowUpload(false)
  }

  const handleOpenRevisions = (dataset: Dataset) => {
    openDrawer('datasetRevisions', { dataset, farmId })
  }

  return (
    <>
      <Drawer
        isOpen={drawers[DRAWER_NAME] || false}
        title="Datasets"
        onClose={() => closeDrawer(DRAWER_NAME)}
        position="left"
        showBackdrop={false}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="flex-1 btn btn-primary flex items-center justify-center gap-2"
            >
              <CloudArrowUpIcon className="w-5 h-5" />
              Upload Dataset
            </button>
            <button
              onClick={handleCreateFolder}
              className="btn btn-secondary flex items-center gap-2"
              title="Create folder"
            >
              <FolderPlusIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex items-center gap-1">
                {index > 0 && <span className="text-gray-300">/</span>}
                <button
                  className={
                    crumb.id === currentFolderId
                      ? 'font-semibold text-primary-600'
                      : 'hover:text-primary-600'
                  }
                  onClick={() => setCurrentFolderId(crumb.id)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          {currentFolderId !== 'root' && (
            <button
              onClick={() => {
                const current = folders.find((folder) => folder.id === currentFolderId)
                setCurrentFolderId(current?.parentId || 'root')
              }}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
            >
              <ArrowLeftIcon className="w-4 h-4" /> Back to parent
            </button>
          )}

          {foldersLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="spinner h-4 w-4" /> Loading folders…
            </div>
          ) : childFolders.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">Folders</p>
              <div className="space-y-2">
                {childFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:border-yellow-400"
                  >
                    <span className="font-medium text-gray-800">{folder.name}</span>
                    {folder.description && (
                      <p className="text-xs text-gray-500">{folder.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="py-8 text-center">
              <div className="spinner mx-auto" />
              <p className="mt-2 text-sm text-gray-500">Loading datasets…</p>
            </div>
          ) : datasets.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">No datasets in this folder yet.</p>
              <p className="mt-1 text-xs text-gray-400">Upload or move datasets to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {datasets.map((dataset) => {
                const recordCount = (dataset as any).recordCount ?? 0
                return (
                  <div
                    key={dataset.id}
                    className="rounded-md border border-gray-200 p-3 hover:border-yellow-400 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{dataset.name}</p>
                        {dataset.description && (
                          <p className="mt-1 text-xs text-gray-500">{dataset.description}</p>
                        )}
                      </div>
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">
                        {recordCount} records
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleLaunchDataset(dataset)}
                        className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        <PlayCircleIcon className="h-4 w-4" /> Launch
                      </button>
                      <button
                        onClick={() => openDrawer('datasetDetails', dataset)}
                        className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        <EyeIcon className="h-4 w-4" /> Details
                      </button>
                      <button
                        onClick={() => openDrawer('copyDataset', { dataset, farmId })}
                        className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4" /> Copy
                      </button>
                      <button
                        onClick={() => handleOpenRevisions(dataset)}
                        className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        History
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Drawer>

      {showUpload && (
        <DatasetUpload
          farmId={farmId}
          folders={folders}
          currentFolderId={currentFolderId}
          onUpload={handleUploadComplete}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {pendingDataset && (
        <DatasetLaunchConfirmModal
          farmId={farmId}
          dataset={pendingDataset}
          onConfirm={handleConfirmLaunch}
          onCancel={handleCancelLaunch}
        />
      )}
    </>
  )
}





