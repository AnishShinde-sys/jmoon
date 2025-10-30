import apiClient from '@/lib/apiClient'

interface SubmitFeedbackPayload {
  message: string
  pageUrl?: string
  farmId?: string
}

export async function submitFeedback(payload: SubmitFeedbackPayload): Promise<void> {
  await apiClient.post('/api/feedback', payload)
}

