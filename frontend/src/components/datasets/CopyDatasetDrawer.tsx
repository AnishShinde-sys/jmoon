"use client"

import { FormEvent, useEffect, useState } from 'react'
import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import { Dataset } from '@/types/dataset'
import apiClient from '@/lib/apiClient'

const DRAWER_NAME = 'copyDataset'

interface DrawerState {
  dataset?: Dataset
  farmId?: string
}

export default function CopyDatasetDrawer({ farmId }: { farmId: string }) {
  const { drawers, closeDrawer, showAlert } = useUI()
  const state = (drawers[DRAWER_NAME] as DrawerState | undefined) || {}
  const dataset = state.dataset as Dataset | undefined

  const [targetName, setTargetName] = useState(() =>
    dataset ? `${dataset.name} Copy` : ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setTargetName(dataset ? `${dataset.name} Copy` : '')
  }, [dataset?.id])

  const handleClose = () => {
    closeDrawer(DRAWER_NAME)
    setTimeout(() => {
      setTargetName(dataset ? `${dataset.name} Copy` : '')
      setIsSubmitting(false)
    }, 150)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!dataset || !farmId) {
      return
    }
    if (!targetName.trim()) {
      showAlert('Please provide a name for the new dataset.', 'warning')
      return
    }

    setIsSubmitting(true)

    try {
      await apiClient.post(`/api/farms/${farmId}/datasets/${dataset.id}/copy`, {
        name: targetName.trim(),
      })
      showAlert('Dataset copy requested. Check the dataset list for updates.', 'success')
      handleClose()
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Copying datasets is not available yet.'
      showAlert(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer
      isOpen={!!dataset}
      title={dataset ? `Copy ${dataset.name}` : 'Copy Dataset'}
      onClose={handleClose}
      position="left"
      showBackdrop={false}
    >
      {!dataset ? (
        <div className="py-6 text-sm text-gray-500">Select a dataset to duplicate it.</div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs uppercase text-gray-500">New Name</label>
            <input
              type="text"
              value={targetName}
              onChange={(event) => setTargetName(event.target.value)}
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder={`${dataset.name} Copy`}
              disabled={isSubmitting}
            />
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3">
            Copying a dataset will create a new static snapshot of the source file once the backend job
            finishes. The original dataset remains unchanged.
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Copying…' : 'Start Copy'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Drawer>
  )
}


