"use client"

import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import { Block } from '@/types/block'

interface BlockRevisionPreviewState {
  block?: Block | null
  revision?: Record<string, any> | null
}

const DRAWER_NAME = 'blockRevisionPreview'

export default function BlockRevisionPreviewDrawer() {
  const { drawers, closeDrawer, openDrawer } = useUI()

  const state = (drawers[DRAWER_NAME] || {}) as BlockRevisionPreviewState
  const block = state?.block || null
  const revision = state?.revision || null
  const properties = (revision?.properties as Block | undefined) || undefined

  const updatedLabel = (() => {
    if (!revision) return 'Unknown'
    const timestamp = revision.updatedOn || revision.updatedAt || revision.createdAt || (properties as any)?.updatedAt
    return timestamp ? new Date(timestamp).toLocaleString() : 'Unknown'
  })()

  const message = revision?.revisionMessage || (properties as any)?.revisionMessage
  const updatedByName = revision?.updatedByName || (properties as any)?.updatedByName

  const handleClose = () => {
    closeDrawer(DRAWER_NAME)
    if (block?.id) {
      setTimeout(() => {
        openDrawer('blockRevisions', block.id)
      }, 120)
    }
  }

  return (
    <Drawer
      isOpen={!!revision}
      title="Revision Details"
      onClose={handleClose}
      position="right"
      showBackdrop={false}
    >
      {!revision ? (
        <div className="py-6 text-sm text-gray-500">
          Select a revision to preview its details.
        </div>
      ) : (
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <p className="text-xs uppercase text-gray-500">Block</p>
            <p className="font-medium">{block?.name || 'Unknown block'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Updated</p>
            <p>{updatedLabel}</p>
          </div>
          {updatedByName && (
            <div>
              <p className="text-xs uppercase text-gray-500">Updated By</p>
              <p>{updatedByName}</p>
            </div>
          )}
          {message && (
            <div>
              <p className="text-xs uppercase text-gray-500">Message</p>
              <p>{message}</p>
            </div>
          )}
          {properties && (
            <div>
              <p className="text-xs uppercase text-gray-500 mb-2">Attributes</p>
              <div className="space-y-1 text-xs">
                {Object.entries(properties).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <span className="text-gray-500">{key}</span>
                    <span className="text-gray-900 text-right break-all">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs uppercase text-gray-500 mb-2">Raw Data</p>
            <pre className="bg-gray-900 text-gray-100 text-xs rounded-md p-3 overflow-x-auto max-h-64">
              {JSON.stringify(revision, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Drawer>
  )
}


