import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, AuthRequest } from '../middleware/auth'
import { gcsClient } from '../services/gcsClient'
import { Farm, CreateFarmInput, UpdateFarmInput } from '../types'
import { Storage } from '@google-cloud/storage'

const router = Router()

/**
 * GET /api/farms
 * List all farms for the authenticated user
 */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    
    // First, get farms from the old system (users/{userId}/farms.json)
    const userFarmsPath = `users/${userId}/farms.json`
    const exists = await gcsClient.exists(userFarmsPath)
    let farmIds: string[] = []
    
    if (exists) {
      farmIds = await gcsClient.readJSON<string[]>(userFarmsPath)
    }

    // Read all farms and filter by access permissions
    const allFarms: Farm[] = []
    
    // Get farms the user owns or is in users array
    const storage = new Storage()
    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)
    const [farmsList] = await bucket.getFiles({ prefix: 'farms/' })
    
    for (const file of farmsList) {
      if (!file.name.includes('/metadata.json')) continue
      
      try {
        const farm = await gcsClient.readJSON<Farm>(file.name)
        
        // Check if user has access via:
        // 1. Owner
        // 2. Old collaborator system
        // 3. New users/permissions system
        const hasAccess = 
          farm.owner === userId ||
          farm.collaborators?.some((c) => c.userId === userId) ||
          farm.users?.some((u) => u.id === userId) ||
          farm.permissions?.[userId]
        
        if (hasAccess) {
          allFarms.push(farm)
        }
      } catch (error) {
        console.error(`Error reading farm ${file.name}:`, error)
      }
    }

    res.json(allFarms)
  } catch (error: any) {
    console.error('Error listing farms:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to list farms',
    })
  }
})

/**
 * POST /api/farms
 * Create a new farm
 */
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const input: CreateFarmInput = req.body

    // Validate required fields
    if (!input.name || !input.location) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Farm name and location are required',
      })
    }

    // Create new farm
    const farmId = uuidv4()
    const now = new Date().toISOString()

    const farm: Farm = {
      id: farmId,
      name: input.name,
      location: input.location,
      owner: userId,
      collaborators: [],
      createdAt: now,
      updatedAt: now,
      blockCount: 0,
      datasetCount: 0,
      totalArea: 0,
    }

    // Save farm metadata
    const farmPath = `farms/${farmId}/metadata.json`
    await gcsClient.writeJSON(farmPath, farm)

    // Initialize empty blocks file
    const blocksPath = `farms/${farmId}/blocks.json`
    await gcsClient.writeJSON(blocksPath, {
      type: 'FeatureCollection',
      features: [],
    })

    // Add farm to user's farms list
    const userFarmsPath = `users/${userId}/farms.json`
    const exists = await gcsClient.exists(userFarmsPath)
    let farmIds: string[] = []

    if (exists) {
      farmIds = await gcsClient.readJSON<string[]>(userFarmsPath)
    }

    farmIds.push(farmId)
    await gcsClient.writeJSON(userFarmsPath, farmIds)

    res.status(201).json(farm)
  } catch (error: any) {
    console.error('Error creating farm:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to create farm',
    })
  }
})

/**
 * GET /api/farms/:farmId
 * Get farm details
 */
router.get('/:farmId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params

    // Read farm metadata
    const farmPath = `farms/${farmId}/metadata.json`
    const exists = await gcsClient.exists(farmPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found',
      })
    }

    const farm = await gcsClient.readJSON<Farm>(farmPath)

    // Check access permissions (check both old and new permission systems)
    const hasAccess =
      farm.owner === userId ||
      farm.collaborators?.some((c) => c.userId === userId) ||
      farm.users?.some((u) => u.id === userId) ||
      farm.permissions?.[userId]

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this farm',
      })
    }

    res.json(farm)
  } catch (error: any) {
    console.error('Error fetching farm:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch farm',
    })
  }
})

/**
 * PUT /api/farms/:farmId
 * Update farm
 */
router.put('/:farmId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params
    const updates: UpdateFarmInput = req.body

    // Read farm metadata
    const farmPath = `farms/${farmId}/metadata.json`
    const exists = await gcsClient.exists(farmPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found',
      })
    }

    const farm = await gcsClient.readJSON<Farm>(farmPath)

    const userRole = farm.permissions?.[userId]
    const canEditFarm =
      farm.owner === userId ||
      userRole === 'Administrator' ||
      userRole === 'Editor'

    if (!canEditFarm) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this farm',
      })
    }

    // Update farm
    const updatedFarm: Farm = {
      ...farm,
      ...updates,
      id: farmId, // Never allow ID to change
      owner: farm.owner, // Never allow owner to change via this endpoint
      updatedAt: new Date().toISOString(),
    }

    await gcsClient.writeJSON(farmPath, updatedFarm)
    res.json(updatedFarm)
  } catch (error: any) {
    console.error('Error updating farm:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to update farm',
    })
  }
})

/**
 * DELETE /api/farms/:farmId
 * Delete farm
 */
router.delete('/:farmId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params

    // Read farm metadata
    const farmPath = `farms/${farmId}/metadata.json`
    const exists = await gcsClient.exists(farmPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found',
      })
    }

    const farm = await gcsClient.readJSON<Farm>(farmPath)

    // Check if user is owner (only owner can delete)
    if (farm.owner !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the farm owner can delete the farm',
      })
    }

    // Delete all farm-related files
    // Note: In production, you might want to use a Cloud Function for this
    const filesToDelete = [
      `farms/${farmId}/metadata.json`,
      `farms/${farmId}/blocks.json`,
    ]

    // Delete datasets if they exist
    try {
      const datasetFiles = await gcsClient.listFiles(`farms/${farmId}/datasets/`)
      filesToDelete.push(...datasetFiles)
    } catch (error) {
      console.log('No datasets to delete')
    }

    // Delete all files
    await Promise.all(
      filesToDelete.map(async (file) => {
        try {
          await gcsClient.delete(file)
        } catch (error) {
          console.error(`Error deleting ${file}:`, error)
        }
      })
    )

    // Remove farm from user's farms list
    const userFarmsPath = `users/${userId}/farms.json`
    const farmIds = await gcsClient.readJSON<string[]>(userFarmsPath)
    const updatedFarmIds = farmIds.filter((id) => id !== farmId)
    await gcsClient.writeJSON(userFarmsPath, updatedFarmIds)

    res.status(204).send()
  } catch (error: any) {
    console.error('Error deleting farm:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to delete farm',
    })
  }
})

export default router
