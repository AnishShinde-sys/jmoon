"use client"

import type { PluginDefinition } from '@/types/plugin'

interface PluginLibraryModalProps {
  plugins: PluginDefinition[]
  enabled: Set<string>
  onClose: () => void
  onToggle: (plugin: PluginDefinition, enabled: boolean) => void | Promise<void>
  togglingId?: string | null
}

export default function PluginLibraryModal({
  plugins,
  enabled,
  onClose,
  onToggle,
  togglingId,
}: PluginLibraryModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Plugin Library</h3>
            <p className="text-sm text-gray-500">
              Activate plugin integrations for this farm. Activated plugins appear in the plugins drawer.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {plugins.map((plugin) => {
              const isEnabled = enabled.has(plugin.id)
              const isProcessing = togglingId === plugin.id

              return (
                <div key={plugin.id} className="rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900">{plugin.name}</h4>
                    {plugin.category && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        {plugin.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{plugin.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className={`text-xs font-medium ${isEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {isEnabled ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => onToggle(plugin, !isEnabled)}
                      disabled={isProcessing}
                      className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                        isEnabled
                          ? 'border border-gray-200 text-gray-600 hover:bg-gray-100'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      } ${isProcessing ? 'opacity-50' : ''}`}
                    >
                      {isProcessing ? 'Saving…' : isEnabled ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

