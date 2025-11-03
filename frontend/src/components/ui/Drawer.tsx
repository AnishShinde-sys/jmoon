import { XMarkIcon } from '@heroicons/react/24/outline'
import { ReactNode, useEffect } from 'react'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  position?: 'left' | 'right'
  showBackdrop?: boolean
  headerActions?: ReactNode
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  showBackdrop = true,
  headerActions,
}: DrawerProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const positionClasses = position === 'left' ? 'left-0' : 'right-0'
  const translateClasses = position === 'left'
    ? isOpen ? '-translate-x-0' : '-translate-x-full'
    : isOpen ? 'translate-x-0' : 'translate-x-full'

  return (
    <>
      {/* Backdrop - only show if enabled */}
      {isOpen && showBackdrop && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 ${positionClasses} h-full w-full md:w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${translateClasses}`}
        style={{ maxWidth: '400px' }}
      >
        {title && (
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold text-gray-900">
                {title}
              </div>
              <div className="flex items-center gap-2">
                {headerActions}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-gray-300 hover:text-gray-700"
                  aria-label="Close drawer"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto h-full">{children}</div>
      </div>
    </>
  )
}
