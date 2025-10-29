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
    <div className="absolute top-32 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-lg p-2">
      {isDrawing && (
        <button
          onClick={onFinish}
          className="flex items-center justify-center w-10 h-10 bg-green-600 text-white hover:bg-green-700 rounded transition-colors"
          title="Finish Drawing"
        >
          <CheckIcon className="w-5 h-5" />
        </button>
      )}
      {hasDrawing && (
        <button
          onClick={onClear}
          className="flex items-center justify-center w-10 h-10 bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
          title="Clear Drawing"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}


