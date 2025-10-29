import { Router } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { gcsClient } from '../services/gcsClient'
import { UserProfile } from '../types'
import { auth } from '../config/firebase'
import { sendCollaboratorInvitation, sendSignupInvitation } from '../services/emailService'
import { storePendingInvitation, processPendingInvitations, getPendingInvitationsByUserId } from '../services/invitationService'

const router = Router()

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const profilePath = `users/${userId}/profile.json`

    // Check if profile exists
    const exists = await gcsClient.exists(profilePath)

    if (!exists) {
      // Return basic profile from JWT
      return res.json({
        id: userId,
        email: req.user!.email,
        role: req.user!.role || 'user',
        createdAt: new Date().toISOString(),
      })
    }

    // Read profile from GCS
    const profile = await gcsClient.readJSON<UserProfile>(profilePath)
    res.json(profile)
  } catch (error: any) {
    console.error('Error fetching user profile:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch user profile',
    })
  }
})

/**
 * POST /api/users/me
 * Create user profile (for new signups)
 */
router.post('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const email = req.user!.email || req.body.email
    const profilePath = `users/${userId}/profile.json`

    // Check if profile already exists
    const exists = await gcsClient.exists(profilePath)
    if (exists) {
      return res.status(409).json({
        error: 'ProfileExists',
        message: 'User profile already exists',
      })
    }

    // Note: We no longer auto-process invitations on signup
    // User will see notifications on dashboard and accept manually

    // Create new profile
    const profile: UserProfile = {
      id: userId,
      email: req.user!.email || req.body.email,
      name: req.body.name || '',
      role: (req.user!.role as 'user' | 'admin') || 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await gcsClient.writeJSON(profilePath, profile)
    res.status(201).json(profile)
  } catch (error: any) {
    console.error('Error creating user profile:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to create user profile',
    })
  }
})

/**
 * GET /api/users
 * Search users by email
 */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { email } = req.query

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Email query parameter is required',
      })
    }

    // Check if user exists in Firebase Auth
    try {
      const userRecord = await auth.getUserByEmail(email)
      
      // User exists, check if profile exists in GCS
      const profilePath = `users/${userRecord.uid}/profile.json`
      const exists = await gcsClient.exists(profilePath)
      
      let profile: any
      if (exists) {
        profile = await gcsClient.readJSON<UserProfile>(profilePath)
      } else {
        // Return basic info from Firebase
        profile = {
          id: userRecord.uid,
          email: userRecord.email,
          name: userRecord.displayName || '',
          createdAt: userRecord.metadata.creationTime,
          updatedAt: userRecord.metadata.lastSignInTime,
        }
      }

      return res.json(profile)
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({
          error: 'NotFound',
          message: 'User not found',
        })
      }
      throw error
    }
  } catch (error: any) {
    console.error('Error searching users:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to search users',
    })
  }
})

/**
 * POST /api/users/invite
 * Invite a user to collaborate on a farm
 */
router.post('/invite', authenticate, async (req: AuthRequest, res) => {
  try {
    const { email, farmId, role, farmName } = req.body
    
    if (!email || !farmId || !role) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Email, farmId, and role are required',
      })
    }

    // Check if user exists
    let userRecord
    let userExists = true
    
    try {
      userRecord = await auth.getUserByEmail(email)
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        userExists = false
      } else {
        throw error
      }
    }

    // If user exists, add them to the farm and send invitation
    if (userExists && userRecord) {
      // Update farm to add user
      const farmPath = `farms/${farmId}/metadata.json`
      const farm = await gcsClient.readJSON<any>(farmPath)
      
      const updatedUsers = [...(farm.users || []), { id: userRecord.uid }]
      const updatedPermissions = {
        ...(farm.permissions || {}),
        [userRecord.uid]: role
      }

      farm.users = updatedUsers
      farm.permissions = updatedPermissions
      farm.updatedAt = new Date().toISOString()

      await gcsClient.writeJSON(farmPath, farm)

      // Send invitation email
      const inviterName = req.user!.email?.split('@')[0] || 'Someone'
      await sendCollaboratorInvitation(email, inviterName, farmName || farm.name, role, farmId)

      return res.json({
        success: true,
        message: 'User invited successfully',
        userId: userRecord.uid,
      })
    } else {
      // User doesn't exist, store pending invitation
      await storePendingInvitation(email, farmId, role, req.user!.id, req.user!.email || '')
      
      // Get farm name for email
      const farmPath = `farms/${farmId}/metadata.json`
      const farm = await gcsClient.readJSON<any>(farmPath)
      
      // Send signup invitation with farm info
      const inviterName = req.user!.email?.split('@')[0] || 'Someone'
      await sendSignupInvitation(email, inviterName, farmName || farm.name, role)

      return res.json({
        success: true,
        message: 'Signup invitation sent. User will be added once they create an account.',
        requiresSignup: true,
      })
    }
  } catch (error: any) {
    console.error('Error inviting user:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to invite user',
    })
  }
})

/**
 * GET /api/users/:userId
 * Get user by ID
 */
router.get('/:userId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params
    const profilePath = `users/${userId}/profile.json`

    const exists = await gcsClient.exists(profilePath)
    
    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'User not found',
      })
    }

    const profile = await gcsClient.readJSON<UserProfile>(profilePath)
    res.json(profile)
  } catch (error: any) {
    console.error('Error fetching user:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch user',
    })
  }
})

/**
 * PUT /api/users/me
 * Update user profile
 */
router.put('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const profilePath = `users/${userId}/profile.json`

    // Read existing profile
    const exists = await gcsClient.exists(profilePath)
    let profile: UserProfile

    if (exists) {
      profile = await gcsClient.readJSON<UserProfile>(profilePath)
    } else {
      // Create new profile if doesn't exist
      profile = {
        id: userId,
        email: req.user!.email || '',
        role: (req.user!.role as 'user' | 'admin') || 'user',
        createdAt: new Date().toISOString(),
      }
    }

    // Update profile fields
    profile = {
      ...profile,
      ...req.body,
      id: userId, // Never allow ID to be changed
      email: req.user!.email || profile.email, // Email comes from JWT
      updatedAt: new Date().toISOString(),
    }

    await gcsClient.writeJSON(profilePath, profile)
    res.json(profile)
  } catch (error: any) {
    console.error('Error updating user profile:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to update user profile',
    })
  }
})

/**
 * GET /api/users/me/invitations
 * Get pending invitations for the current user
 */
router.get('/me/invitations', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const invitations = await getPendingInvitationsByUserId(userId)
    res.json(invitations)
  } catch (error: any) {
    console.error('Error fetching invitations:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch invitations',
    })
  }
})

/**
 * POST /api/users/me/invitations/:farmId/accept
 * Accept a pending invitation
 */
router.post('/me/invitations/:farmId/accept', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params
    
    // Get user email for looking up invitation
    const profilePath = `users/${userId}/profile.json`
    const profile = await gcsClient.readJSON<{ email?: string }>(profilePath)
    
    if (!profile.email) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'User profile email not found',
      })
    }
    
    // Get the invitation
    const invitationPath = `invitations/${profile.email}/${farmId}.json`
    const exists = await gcsClient.exists(invitationPath)
    
    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Invitation not found',
      })
    }
    
    const invitation = await gcsClient.readJSON<any>(invitationPath)
    
    // Add user to farm
    const farmPath = `farms/${farmId}/metadata.json`
    const farm = await gcsClient.readJSON<any>(farmPath)
    
    const updatedUsers = [...(farm.users || []), { id: userId }]
    const updatedPermissions = {
      ...(farm.permissions || {}),
      [userId]: invitation.role
    }

    farm.users = updatedUsers
    farm.permissions = updatedPermissions
    farm.updatedAt = new Date().toISOString()

    await gcsClient.writeJSON(farmPath, farm)
    
    // Delete the invitation file
    await gcsClient.delete(invitationPath)
    
    res.json({
      success: true,
      message: 'Invitation accepted',
      farm,
    })
  } catch (error: any) {
    console.error('Error accepting invitation:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to accept invitation',
    })
  }
})

/**
 * POST /api/users/me/invitations/:farmId/decline
 * Decline a pending invitation
 */
router.post('/me/invitations/:farmId/decline', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params
    
    // Get user email for looking up invitation
    const profilePath = `users/${userId}/profile.json`
    const profile = await gcsClient.readJSON<{ email?: string }>(profilePath)
    
    if (!profile.email) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'User profile email not found',
      })
    }
    
    // Delete the invitation file
    const invitationPath = `invitations/${profile.email}/${farmId}.json`
    await gcsClient.delete(invitationPath)
    
    res.json({
      success: true,
      message: 'Invitation declined',
    })
  } catch (error: any) {
    console.error('Error declining invitation:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to decline invitation',
    })
  }
})

export default router
