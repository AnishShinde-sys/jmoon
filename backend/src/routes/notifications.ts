import { Router } from 'express'

import { authenticate, AuthRequest } from '../middleware/auth'
import { addNotification, getNotificationsForUser, markNotificationRead } from '../services/notificationService'

const router = Router()

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const notifications = await getNotificationsForUser(userId)
    res.json(notifications)
  } catch (error: any) {
    console.error('Failed to load notifications:', error)
    res.status(500).json({
      error: 'InternalError',
      message: error?.message || 'Failed to load notifications',
    })
  }
})

router.post('/:notificationId/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const { notificationId } = req.params
    await markNotificationRead(notificationId)
    res.json({ success: true })
  } catch (error: any) {
    console.error('Failed to mark notification read:', error)
    res.status(500).json({
      error: 'InternalError',
      message: error?.message || 'Failed to mark notification read',
    })
  }
})

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { recipient, message, url, type, metadata } = req.body || {}

    if (!recipient || !message) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'recipient and message are required',
      })
    }

    const result = await addNotification({ recipient, message, url, type, metadata })
    res.status(201).json({ id: result.id })
  } catch (error: any) {
    console.error('Failed to create notification:', error)
    res.status(500).json({
      error: 'InternalError',
      message: error?.message || 'Failed to create notification',
    })
  }
})

export default router
