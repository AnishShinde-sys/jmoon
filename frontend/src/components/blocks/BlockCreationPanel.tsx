"use client"

import { useMemo } from 'react'
import { MapIcon, PencilSquareIcon } from '@heroicons/react/24/outline'

import type { MeasurementSystem } from '@/types/user'

interface BlockCreationPanelProps {
  mode: 'create' | 'edit'
  name: string
  description: string
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
  onResetGeometry: () => void
  hasGeometry: boolean
  areaSqMeters: number | null
  measurementSystem?: MeasurementSystem
  saving: boolean
}

const SQ_METERS_PER_HECTARE = 10_000
const SQ_METERS_PER_ACRE = 4046.8564224

export default function BlockCreationPanel({
  mode,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onCancel,
  onSave,
  onResetGeometry,
  hasGeometry,
  areaSqMeters,
  measurementSystem = 'Metric',
  saving,
}: BlockCreationPanelProps) {
  const isCreate = mode === 'create'

  const areaDisplay = useMemo(() => {
    if (areaSqMeters === null || Number.isNaN(areaSqMeters)) {
      return null
    }

    const hectares = areaSqMeters / SQ_METERS_PER_HECTARE
    const acres = areaSqMeters / SQ_METERS_PER_ACRE
    const formattedMetric = `${hectares.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`
    const formattedImperial = `${acres.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac`

    return {
      metric: formattedMetric,
      imperial: formattedImperial,
      raw: `${areaSqMeters.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²`,
    }
  }, [areaSqMeters])

  const canSave = hasGeometry && name.trim().length > 0 && !saving

  const title = isCreate ? 'Drawing new block' : 'Editing block'
  const instructions = isCreate
    ? 'Click on the map to outline the block. Double-click to finish. Use the trash button on the map to remove the current shape.'
    : 'Adjust the block outline by dragging vertices in the map. Use the trash button to remove the current footprint and redraw if needed.'
  const resetLabel = isCreate ? 'Redraw footprint' : 'Reset footprint'
  const saveLabel = saving ? 'Saving…' : isCreate ? 'Save Block' : 'Save Changes'

  return (
    <div className="space-y-4 rounded-lg border border-primary-200 bg-primary-50/70 p-4 text-sm text-gray-700">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <MapIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary-900">{title}</p>
          <p className="text-xs text-primary-700">{instructions}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-primary-100 bg-white p-3 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="block-name-input">
          Block name
        </label>
        <input
          id="block-name-input"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="E.g. North Vineyard"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />

        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="block-description-input">
          Description (optional)
        </label>
        <textarea
          id="block-description-input"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={3}
          placeholder="Notes about this block"
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />

        <div className="rounded-md bg-primary-50 px-3 py-2 text-xs text-primary-700">
          {hasGeometry ? (
            <div className="space-y-1">
              <p className="font-semibold text-primary-800">Footprint captured</p>
              {areaDisplay ? (
                <p>
                  Area:&nbsp;
                  <span className="font-medium text-primary-900">
                    {measurementSystem === 'Imperial' ? areaDisplay.imperial : areaDisplay.metric}
                  </span>
                  <span className="ml-2 text-primary-500">({areaDisplay.raw})</span>
                </p>
              ) : (
                <p>Area calculation unavailable.</p>
              )}
              <button
                type="button"
                onClick={onResetGeometry}
                className="inline-flex items-center gap-1 rounded-md border border-primary-200 px-2 py-1 text-xs font-medium text-primary-700 transition hover:border-primary-300 hover:text-primary-900"
              >
                {resetLabel}
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <PencilSquareIcon className="mt-0.5 h-4 w-4 flex-none text-primary-500" aria-hidden="true" />
              <p>
                {isCreate
                  ? 'Select the polygon tool in the map toolbar and outline the block to continue.'
                  : 'Use the handles that appear on the block to adjust its shape, or redraw the footprint.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}
