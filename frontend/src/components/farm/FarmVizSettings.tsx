import { Farm } from '@/types/farm'

interface FarmVizSettingsProps {
  farm: Farm
  onUpdate: (settings: Farm['vizSettings']) => void
}

export default function FarmVizSettings({ farm, onUpdate }: FarmVizSettingsProps) {
  const vizSettings = farm.vizSettings || {
    colorOpacity: 0.8,
    colorBy: 'solid',
    blockColor: '#6e59c7',
    labelBy: 'noLabel',
  }

  const handleOpacityChange = (value: number) => {
    onUpdate({ ...vizSettings, colorOpacity: value })
  }

  const handleColorChange = (color: string) => {
    onUpdate({ ...vizSettings, blockColor: color })
  }

  const handleLabelChange = (labelType: 'noLabel' | 'blockName' | 'headerValue') => {
    onUpdate({ ...vizSettings, labelBy: labelType })
  }

  return (
    <div className="space-y-6">
      {/* Block Opacity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Block Opacity: {vizSettings.colorOpacity}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={vizSettings.colorOpacity}
          onChange={(e) => handleOpacityChange(Number(e.target.value))}
          className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #4ade80 0%, #4ade80 ${vizSettings.colorOpacity * 100}%, #e5e7eb ${vizSettings.colorOpacity * 100}%, #e5e7eb 100%)`
          }}
        />
      </div>

      {/* Block Color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Block Color
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => {
              // Trigger click on the hidden color input
              const colorInput = document.getElementById('block-color-input') as HTMLInputElement
              colorInput?.click()
            }}
            className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer hover:border-gray-400 transition-colors"
            style={{ backgroundColor: vizSettings.blockColor }}
            title="Click to change color"
          />
          <input
            id="block-color-input"
            type="color"
            value={vizSettings.blockColor}
            onChange={(e) => handleColorChange(e.target.value)}
            className="input opacity-0 w-0 h-0 absolute"
          />
        </div>
      </div>

      {/* Block Labeling */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Block Labeling
        </label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleLabelChange('noLabel')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              vizSettings.labelBy === 'noLabel'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            No Label
          </button>
          <button
            onClick={() => handleLabelChange('blockName')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              vizSettings.labelBy === 'blockName'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            Block Name
          </button>
          <button
            onClick={() => handleLabelChange('headerValue')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              vizSettings.labelBy === 'headerValue'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            Header Value
          </button>
        </div>
      </div>
    </div>
  )
}
