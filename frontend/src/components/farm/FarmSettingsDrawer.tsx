"use client"

import { useState, useEffect, useRef, FormEvent } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Farm } from '@/types/farm'
import { useUI } from '@/context/UIContext'

interface FarmSettingsDrawerProps {
  isOpen: boolean
  farm: Farm | null
  onClose: () => void
  onUpdate: (farm: Farm) => void
}

export default function FarmSettingsDrawer({
  isOpen,
  farm,
  onClose,
  onUpdate,
}: FarmSettingsDrawerProps) {
  const { drawers } = useUI()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (farm) {
      setName(farm.name || '')
      setDescription(farm.description || '')
    }
  }, [farm])

  useEffect(() => {
    if (!isOpen || !drawers.farmSettings) {
      return
    }

    const focusTimeout = window.setTimeout(() => {
      nameInputRef.current?.focus()
    }, 50)

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!popoverRef.current) return
      const target = event.target as Node | null
      if (target && !popoverRef.current.contains(target)) {
        onClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimeout)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, drawers.farmSettings, onClose])

  if (!isOpen || !drawers.farmSettings || !farm) {
    return null
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onUpdate({
      ...farm,
      name,
      description,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center md:justify-end pointer-events-none">
      <div
        ref={popoverRef}
        className="pointer-events-auto mx-4 mt-24 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl md:ml-0 md:mr-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="farm-settings-heading"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id="farm-settings-heading" className="text-xl font-semibold text-gray-900">
            Farm Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 rounded-full"
            type="button"
            aria-label="Close farm settings"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="farm-id" className="mb-2 block text-sm font-medium text-gray-700">
                Farm ID
              </label>
              <input
                id="farm-id"
                type="text"
                value={farm.id}
                readOnly
                className="w-full cursor-text select-all rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              />
              <p className="mt-1 text-xs text-gray-400">Use this identifier when contacting support.</p>
            </div>

            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-700">
                Farm Name
              </label>
              <input
                id="name"
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-yellow-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

