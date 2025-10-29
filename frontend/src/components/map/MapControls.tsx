import { useState } from 'react'

interface MapControlsProps {
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetView?: () => void
  onToggleStyle?: () => void
  onToggleDrawing?: () => void
  drawingEnabled?: boolean
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleStyle,
  onToggleDrawing,
  drawingEnabled = false,
}: MapControlsProps) {
  const [styleType, setStyleType] = useState<'satellite' | 'streets'>('satellite')

  const handleToggleStyle = () => {
    const newStyle = styleType === 'satellite' ? 'streets' : 'satellite'
    setStyleType(newStyle)
    if (onToggleStyle) onToggleStyle()
  }

  return (
    <div className="absolute top-24 right-4 flex flex-col gap-2">
      {/* Zoom Controls */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={onZoomIn}
          className="block w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-100 border-b border-gray-200"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={onZoomOut}
          className="block w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-100"
          title="Zoom Out"
        >
          −
        </button>
      </div>

      {/* Style Toggle */}
      {onToggleStyle && (
        <button
          onClick={handleToggleStyle}
          className="bg-white rounded-lg shadow-md p-2 text-xs text-gray-700 hover:bg-gray-100"
          title="Toggle Map Style"
        >
          {styleType === 'satellite' ? '🗺️ Streets' : '🛰️ Satellite'}
        </button>
      )}

      {/* Reset View */}
      {onResetView && (
        <button
          onClick={onResetView}
          className="bg-white rounded-lg shadow-md p-2 text-xs text-gray-700 hover:bg-gray-100"
          title="Reset View"
        >
          🎯 Reset
        </button>
      )}

      {/* Drawing Toggle */}
      {onToggleDrawing && (
        <button
          onClick={onToggleDrawing}
          className={`rounded-lg shadow-md p-2 text-xs ${
            drawingEnabled
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
          title="Toggle Drawing Mode"
        >
          ✏️ Draw
        </button>
      )}
    </div>
  )
}
