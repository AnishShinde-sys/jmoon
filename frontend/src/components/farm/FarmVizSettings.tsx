import { useId, useRef, type ChangeEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Farm, VizSettings } from '@/types/farm'

interface FarmVizSettingsProps {
  farm: Farm
  onUpdate: (settings: Farm['vizSettings']) => void
}

const defaultVizSettings: VizSettings = {
  colorOpacity: 0.8,
  colorBy: 'solid',
  blockColor: '#6e59c7',
  labelBy: 'noLabel',
}

const presetColors = ['#6e59c7', '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] as const
const quickOpacityValues = [20, 40, 60, 80, 100] as const

const labelOptions: Array<{
  value: VizSettings['labelBy']
  title: string
  description: string
}> = [
  {
    value: 'noLabel',
    title: 'No Labels',
    description: 'Hide labels for a clean, presentation-ready map.',
  },
  {
    value: 'blockName',
    title: 'Block Name',
    description: 'Show the saved name for each block on the map.',
  },
  {
    value: 'headerValue',
    title: 'Header Value',
    description: 'Display the latest value from your selected data header.',
  },
]

export default function FarmVizSettings({ farm, onUpdate }: FarmVizSettingsProps) {
  const vizSettings: VizSettings = {
    ...defaultVizSettings,
    ...(farm.vizSettings ?? {}),
  }

  const opacitySliderId = useId()
  const opacityInputId = useId()
  const colorPickerId = useId()
  const colorInputRef = useRef<HTMLInputElement>(null)

  const opacityPercent = Math.round(vizSettings.colorOpacity * 100)

  const updateOpacity = (normalizedValue: number) => {
    if (Number.isNaN(normalizedValue)) return
    const clamped = Math.max(0, Math.min(1, normalizedValue))
    const rounded = Math.round(clamped * 100) / 100
    onUpdate({ ...vizSettings, colorOpacity: rounded })
  }

  const handleOpacitySliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateOpacity(event.target.valueAsNumber / 100)
  }

  const handleOpacityInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateOpacity(event.target.valueAsNumber / 100)
  }

  const updateColor = (color: string) => {
    if (!color) return
    onUpdate({ ...vizSettings, blockColor: color })
  }

  const handleColorPickerChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateColor(event.target.value)
  }

  const handleLabelChange = (labelType: VizSettings['labelBy']) => {
    onUpdate({ ...vizSettings, labelBy: labelType })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-200 bg-white/95 p-4 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-800">Block Opacity</h3>
          <p className="text-xs text-gray-500">Make blocks more transparent or bold to match your view.</p>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3">
            <label htmlFor={opacitySliderId} className="text-xs font-medium text-gray-600">
              Visibility
            </label>
            <div className="flex items-center gap-4">
              <input
                id={opacitySliderId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={opacityPercent}
                onChange={handleOpacitySliderChange}
                className="flex-1 h-2 cursor-pointer appearance-none rounded-full bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-0"
                style={{
                  background: `linear-gradient(to right, #facc15 0%, #facc15 ${opacityPercent}%, #e5e7eb ${opacityPercent}%, #e5e7eb 100%)`,
                }}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={opacityPercent}
                aria-label="Block opacity percentage"
              />
              <div className="flex items-center gap-1">
                <label htmlFor={opacityInputId} className="sr-only">
                  Block opacity percentage input
                </label>
                <Input
                  id={opacityInputId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={5}
                  value={opacityPercent}
                  onChange={handleOpacityInputChange}
                  className="w-20 text-right"
                  aria-label="Set block opacity percentage manually"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickOpacityValues.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={value === opacityPercent ? 'default' : 'outline'}
                onClick={() => updateOpacity(value / 100)}
              >
                {value}%
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white/95 p-4 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-800">Block Color</h3>
          <p className="text-xs text-gray-500">Pick a new color or use a preset swatch for all blocks.</p>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span
                className="h-10 w-10 rounded-md border border-gray-300 shadow-inner"
                style={{ backgroundColor: vizSettings.blockColor }}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Current</p>
                <p className="font-mono text-sm text-gray-800">{vizSettings.blockColor.toUpperCase()}</p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => colorInputRef.current?.click()}
            >
              Pick a color
            </Button>

            <input
              ref={colorInputRef}
              id={colorPickerId}
              type="color"
              className="sr-only"
              value={vizSettings.blockColor}
              onChange={handleColorPickerChange}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {presetColors.map((color) => {
              const isActive = color.toLowerCase() === vizSettings.blockColor.toLowerCase()
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateColor(color)}
                  className={cn(
                    'h-9 w-9 rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2',
                    isActive
                      ? 'border-yellow-500 ring-2 ring-yellow-500 ring-offset-2'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Use color ${color}`}
                />
              )
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white/95 p-4 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-800">Block Labeling</h3>
          <p className="text-xs text-gray-500">Choose how block labels appear on the map.</p>
        </div>

        <div className="mt-4 grid gap-2">
          {labelOptions.map((option) => {
            const isActive = vizSettings.labelBy === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleLabelChange(option.value)}
                className={cn(
                  'w-full rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2',
                  isActive
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-900 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
                aria-pressed={isActive}
              >
                <p className="text-sm font-semibold">{option.title}</p>
                <p className="text-xs text-gray-500">{option.description}</p>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
