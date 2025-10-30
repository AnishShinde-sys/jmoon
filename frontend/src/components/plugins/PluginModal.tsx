"use client"

import { useEffect, useCallback } from 'react'
import type { PluginDefinition } from '@/types/plugin'

interface PluginModalProps {
  plugin: PluginDefinition
  url: string
  onClose: () => void
}

export default function PluginModal({ plugin, url, onClose }: PluginModalProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{plugin.name}</h3>
            <p className="text-sm text-gray-500">{plugin.description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <iframe
            src={url}
            title={plugin.name}
            className="h-[70vh] w-full"
            allow="clipboard-write"
          />
        </div>

        <div className="flex justify-between border-t border-gray-200 px-6 py-3 text-xs text-gray-500">
          <span>Embedded plugin surface</span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 hover:text-primary-700"
          >
            Open in new tab ↗
          </a>
        </div>
      </div>
    </div>
  )
}

