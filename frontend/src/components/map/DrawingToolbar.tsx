import { useState } from 'react'
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'

interface DrawingToolbarProps {
  onStartDrawing: () => void
  onClear: () => void
  onFinish: () => void
  isDrawing: boolean
  hasDrawing: boolean
}

export default function DrawingToolbar({ onStartDrawing, onClear, onFinish, isDrawing, hasDrawing }: DrawingToolbarProps) {
  // Don't show toolbar unless we're actively drawing
  if (!isDrawing && !hasDrawing) {
    return null
  }

  return (
    <div className="absolute top-32 right-4 mapboxgl-ctrl mapboxgl-ctrl-group">
      {isDrawing && (
        <button
          type="button"
          onClick={onFinish}
          className="mapboxgl-ctrl-icon inline-flex h-9 w-9 items-center justify-center !bg-transparent !bg-none transition hover:bg-gray-100"
          title="Finish Drawing"
        >
          <CheckIcon className="h-5 w-5 text-green-600" aria-hidden="true" />
          <span className="sr-only">Finish Drawing</span>
        </button>
      )}
      {hasDrawing && (
        <button
          type="button"
          onClick={onClear}
          className="mapboxgl-ctrl-icon inline-flex h-9 w-9 items-center justify-center !bg-transparent !bg-none transition hover:bg-gray-100"
          title="Clear Drawing"
        >
          <TrashIcon className="h-5 w-5 text-red-600" aria-hidden="true" />
          <span className="sr-only">Clear Drawing</span>
        </button>
      )}
    </div>
  )
}


