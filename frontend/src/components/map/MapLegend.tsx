import { VizSettings } from '@/types/dataset'

interface MapLegendProps {
  vizSettings: VizSettings
  visible?: boolean
  onToggle?: () => void
}

export default function MapLegend({ vizSettings, visible = true, onToggle }: MapLegendProps) {
  if (!visible) {
    return (
      <div className="absolute bottom-20 right-4 bg-white rounded-lg shadow-lg p-2">
        <button onClick={onToggle} className="text-gray-600 hover:text-gray-900">
          Show Legend
        </button>
      </div>
    )
  }

  const getColorStops = () => {
    const { zones, min = 0, max = 100 } = vizSettings
    const colors = zones === 3
      ? ['rgb(194,82,60)', 'rgb(123,237,0)', 'rgb(11,44,122)']
      : ['rgb(194,82,60)', 'rgb(240,180,17)', 'rgb(123,237,0)', 'rgb(27,168,124)', 'rgb(11,44,122)']

    const range = max - min
    const step = range / zones

    return colors.map((color, i) => ({
      color,
      min: (min + step * i).toFixed(2),
      max: (min + step * (i + 1)).toFixed(2),
    }))
  }

  const colorStops = getColorStops()

  return (
    <div className="absolute bottom-20 right-4 bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Legend</h3>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {vizSettings.header && (
        <p className="text-xs text-gray-600 mb-3">{vizSettings.header}</p>
      )}

      <div className="space-y-2">
        {colorStops.map((stop, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border border-gray-300"
              style={{ backgroundColor: stop.color }}
            />
            <span className="text-xs text-gray-700">
              {stop.min} - {stop.max}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Classification: {vizSettings.classification}
        </p>
        <p className="text-xs text-gray-500">
          Zones: {vizSettings.zones}
        </p>
      </div>
    </div>
  )
}
