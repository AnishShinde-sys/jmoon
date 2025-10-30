'use client'

import { SparklesIcon, MapPinIcon, WrenchScrewdriverIcon, PowerIcon } from '@heroicons/react/24/outline'

import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'

type FirstFarmModalProps = {
  isOpen: boolean
  onCreate: () => void
  onDismiss: () => void
  onSignOut: () => void
}

export default function FirstFarmModal({ isOpen, onCreate, onDismiss, onSignOut }: FirstFarmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onDismiss} title="Welcome to Budbase" size="xl">
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          You’‍re just a step away from getting your operation into Budbase. Create your first farm to unlock block management, datasets, and collaborative tools.
        </p>

        <div className="grid gap-3 text-sm text-gray-700">
          <div className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <SparklesIcon className="mt-0.5 h-5 w-5 text-primary-600" />
            <div>
              <p className="font-medium text-gray-900">Name your farm</p>
              <p className="text-xs text-gray-500">We’ll use this to organise blocks, collaborators, and datasets.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <MapPinIcon className="mt-0.5 h-5 w-5 text-primary-600" />
            <div>
              <p className="font-medium text-gray-900">Set a location (optional)</p>
              <p className="text-xs text-gray-500">Drop a pin so maps and weather layers line up with reality.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <WrenchScrewdriverIcon className="mt-0.5 h-5 w-5 text-primary-600" />
            <div>
              <p className="font-medium text-gray-900">Start building</p>
              <p className="text-xs text-gray-500">Once your farm is created you can draw blocks, upload datasets, and invite collaborators.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-4">
          <Button variant="outline" onClick={onSignOut} className="flex items-center gap-2">
            <PowerIcon className="h-4 w-4" /> Sign Out
          </Button>
          <Button variant="secondary" onClick={onDismiss} className="flex items-center gap-2">
            Not Now
          </Button>
          <Button onClick={onCreate}>Create Farm</Button>
        </div>
      </div>
    </Modal>
  )
}
