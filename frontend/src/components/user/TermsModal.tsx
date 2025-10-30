'use client'

import Modal from '@/components/ui/Modal'
import { useUI } from '@/context/UIContext'
import { useUserProfile } from '@/context/UserProfileContext'
import { TERMS_SECTIONS, TERMS_UPDATED, TERMS_VERSION } from '@/constants/terms'

export default function TermsModal() {
  const { modals, closeModal, showAlert } = useUI()
  const { profile, updateProfile } = useUserProfile()
  const isOpen = Boolean(modals.termsOfService)

  const handleAgree = async () => {
    try {
      await updateProfile({ tosId: TERMS_VERSION })
      closeModal('termsOfService')
      showAlert('Thanks for accepting the latest terms.', 'success')
    } catch (error: any) {
      showAlert(error?.message || 'Failed to record agreement. Please try again.', 'error')
    }
  }

  const handleClose = () => {
    if (!profile || profile.tosId === TERMS_VERSION) {
      closeModal('termsOfService')
    } else {
      showAlert('You must accept the terms to continue using Budbase.', 'warning')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Terms & Conditions" size="2xl">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <strong>Updated:</strong> {TERMS_UPDATED}
        </p>
        <p className="text-sm text-gray-700">
          Budbase is a beta application and is actively developed. Please review the following before continuing.
        </p>
        <div className="space-y-3">
          {TERMS_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
              <p className="mt-1 text-sm text-gray-700 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleClose}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAgree}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            I Agree
          </button>
        </div>
      </div>
    </Modal>
  )
}

