import { ReactNode, useEffect } from 'react'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  position?: 'left' | 'right'
  showBackdrop?: boolean
}

export default function Drawer({ isOpen, onClose, title, children, position = 'right', showBackdrop = true }: DrawerProps) {
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
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <div className="px-6 py-4 overflow-y-auto h-full">{children}</div>
      </div>
    </>
  )
}
