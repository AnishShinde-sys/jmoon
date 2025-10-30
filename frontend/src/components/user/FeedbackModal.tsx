'use client'

import { FormEvent, useEffect, useState } from 'react'

import Modal from '@/components/ui/Modal'
import { useUI } from '@/context/UIContext'
import { submitFeedback } from '@/services/feedbackService'

export default function FeedbackModal() {
  const { modals, closeModal, showAlert } = useUI()
  const isOpen = Boolean(modals.feedback)
  const [message, setMessage] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPageUrl(window.location.href)
    }
  }, [isOpen])

  const handleClose = () => {
    if (!submitting) {
      closeModal('feedback')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!message.trim()) {
      showAlert('Please provide a message before submitting feedback.', 'warning')
      return
    }

    try {
      setSubmitting(true)
      await submitFeedback({
        message: message.trim(),
        pageUrl,
      })
      showAlert('Thank you for the feedback!', 'success')
      setMessage('')
      closeModal('feedback')
    } catch (error: any) {
      showAlert(error?.message || 'Failed to submit feedback', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Send Feedback" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700">
            Tell us what’s going on
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Be as detailed as possible so we can help."
            rows={6}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        <div>
          <label htmlFor="feedback-page" className="block text-sm font-medium text-gray-700">
            Page URL (optional)
          </label>
          <input
            id="feedback-page"
            type="url"
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send Feedback'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

