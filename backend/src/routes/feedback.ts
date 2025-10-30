import { Router } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { sendFeedbackEmail } from '../services/emailService'

const router = Router()

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message, pageUrl, farmId } = req.body || {}

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Feedback message is required',
      })
    }

    const fromEmail = req.user?.email
    if (!fromEmail) {
      return res.status(400).json({
        error: 'ProfileError',
        message: 'User email not available',
      })
    }

    await sendFeedbackEmail({
      fromEmail,
      message: message.trim(),
      pageUrl,
      farmId,
      userName: req.user?.name,
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error sending feedback:', error)
    res.status(500).json({
      error: 'InternalError',
      message: error?.message || 'Failed to send feedback',
    })
  }
})

export default router

