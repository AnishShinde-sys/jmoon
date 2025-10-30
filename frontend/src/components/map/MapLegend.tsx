'use client'

import { useMapContext } from '@/context/MapContext'

export default function MapLegend() {
  const { legend } = useMapContext()

  if (!legend || legend.entries.length === 0) {
    return null
  }

  const formatValue = (value?: number) => {
    if (value === undefined) return undefined
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 shadow-lg backdrop-blur px-4 py-3 text-xs text-gray-700 min-w-[180px]">
      {legend.title && <p className="mb-2 text-sm font-semibold text-gray-900">{legend.title}</p>}
      <div className="space-y-2">
        {legend.mode === 'range' && legend.min !== undefined && legend.max !== undefined ? (
          <div className="space-y-1">
            {legend.entries.map((entry, index) => (
              <div key={`${entry.color}-${index}`} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                  <span>{entry.label}</span>
                </div>
                <div className="text-[10px] text-gray-500">
                  {formatValue(entry.min)} – {formatValue(entry.max)}
                </div>
              </div>
            ))}
          </div>
        ) : legend.mode === 'category' ? (
          <div className="space-y-1">
            {legend.entries.map((entry, index) => (
              <div key={`${entry.color}-${index}`} className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span>{entry.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: legend.entries[0].color }} />
            <span>{legend.entries[0].label}</span>
          </div>
        )}
      </div>
      {legend.mode === 'range' && legend.min !== undefined && legend.max !== undefined && (
        <p className="mt-3 text-[10px] text-gray-400">Min: {formatValue(legend.min)} • Max: {formatValue(legend.max)}</p>
      )}
    </div>
  )
}
