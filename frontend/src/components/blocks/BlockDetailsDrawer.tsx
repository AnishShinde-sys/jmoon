"use client"

import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import type { Block, BlockFieldDefinition } from '@/types/block'
import type { MeasurementSystem } from '@/types/user'
import BlockDetailsPanel from './BlockDetailsPanel'

interface BlockDetailsDrawerProps {
  isOpen: boolean
  block: Block | null
  blockFields?: BlockFieldDefinition[]
  blockFeature?: GeoJSON.Feature | null
  measurementSystem?: MeasurementSystem
  onClose: () => void
  onEdit?: (block: Block) => void
  onShowRevisions?: (block: Block) => void
  onFocus?: (block: Block, feature?: GeoJSON.Feature | null) => void
}

export default function BlockDetailsDrawer({
  isOpen,
  block,
  blockFields,
  blockFeature,
  measurementSystem,
  onClose,
  onEdit,
  onShowRevisions,
  onFocus,
}: BlockDetailsDrawerProps) {
  return (
    <div
      aria-hidden={!isOpen}
      className={clsx(
        'pointer-events-none absolute inset-y-0 right-0 z-40 flex w-full justify-end transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <aside className="pointer-events-auto h-full w-full max-w-lg border-l border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Block Details</h2>
            {block?.name && <p className="text-xs text-gray-500">{block.name}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
            aria-label="Close block details"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="h-[calc(100%-56px)] overflow-y-auto px-4 py-4">
          <BlockDetailsPanel
            block={block}
            blockFields={blockFields}
            measurementSystem={measurementSystem}
            onEdit={(entity) => {
              if (entity && onEdit) {
                onEdit(entity)
              }
            }}
            onShowRevisions={(entity) => {
              if (entity && onShowRevisions) {
                onShowRevisions(entity)
              }
            }}
            onFocus={(entity) => {
              if (entity && onFocus) {
                onFocus(entity, blockFeature || null)
              }
            }}
          />
        </div>
      </aside>
    </div>
  )
}
