import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, AuthRequest } from '../middleware/auth'
import { gcsClient } from '../services/gcsClient'
import { Farm, Block, CreateBlockInput, BlockRevision } from '../types'
import { Feature } from 'geojson'
import * as turf from '@turf/turf'

const router = Router()

/**
 * Helper: Check if user has access to farm
 */
export async function checkFarmAccess(farmId: string, userId: string): Promise<Farm | null> {
  try {
    const farmPath = `farms/${farmId}/metadata.json`
    const exists = await gcsClient.exists(farmPath)

    if (!exists) {
      return null
    }

    const farm = await gcsClient.readJSON<Farm>(farmPath)

    // Check access via old and new permission systems
    const hasAccess =
      farm.owner === userId ||
      farm.collaborators?.some((c) => c.userId === userId && c.role !== 'viewer') ||
      farm.users?.some((u) => u.id === userId) ||
      farm.permissions?.[userId]

    return hasAccess ? farm : null
  } catch (error) {
    console.error('Error checking farm access:', error)
    return null
  }
}

function getRevisionsPath(farmId: string, blockId: string): string {
  return `farms/${farmId}/blocks/${blockId}/revisions.json`
}

async function readBlockRevisions(farmId: string, blockId: string): Promise<BlockRevision[]> {
  const path = getRevisionsPath(farmId, blockId)
  try {
    const exists = await gcsClient.exists(path)
    if (!exists) {
      return []
    }

    const data = await gcsClient.readJSON<BlockRevision[]>(path)
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Error reading block revisions:', error)
    return []
  }
}

async function writeBlockRevisions(farmId: string, blockId: string, revisions: BlockRevision[]): Promise<void> {
  const path = getRevisionsPath(farmId, blockId)
  await gcsClient.writeJSON(path, revisions)
}

/**
 * GET /api/farms/:farmId/blocks
 * Get all blocks for a farm as GeoJSON FeatureCollection
 */
router.get('/farms/:farmId/blocks', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params

    // Check access
    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Read blocks GeoJSON
    const blocksPath = `farms/${farmId}/blocks.json`
    const exists = await gcsClient.exists(blocksPath)

    if (!exists) {
      // Return empty FeatureCollection
      return res.json({
        type: 'FeatureCollection',
        features: [],
      })
    }

    const blocks = await gcsClient.readJSON(blocksPath)
    res.json(blocks)
  } catch (error: any) {
    console.error('Error fetching blocks:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch blocks',
    })
  }
})

/**
 * POST /api/farms/:farmId/blocks
 * Create a new block
 */
router.post('/farms/:farmId/blocks', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params
    const input: CreateBlockInput = req.body

    // Check access
    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Validate required fields
    if (!input.name || !input.geometry) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Block name and geometry are required',
      })
    }

    // Read existing blocks
    const blocksPath = `farms/${farmId}/blocks.json`
    let blocksGeoJSON: any = {
      type: 'FeatureCollection',
      features: [],
    }

    const exists = await gcsClient.exists(blocksPath)
    if (exists) {
      blocksGeoJSON = await gcsClient.readJSON(blocksPath)
    }

    // Create new block
    const blockId = uuidv4()
    const now = new Date().toISOString()

    // Calculate area
    const area = turf.area(input.geometry)

    const block: Block = {
      id: blockId,
      farmId,
      name: input.name,
      variety: input.variety,
      plantingYear: input.plantingYear,
      rowSpacing: input.rowSpacing,
      vineSpacing: input.vineSpacing,
      area,
      createdAt: now,
      updatedAt: now,
    }

    // Create GeoJSON feature
    const feature = {
      type: 'Feature',
      id: blockId,
      properties: block,
      geometry: input.geometry,
    }

    // Add to features
    blocksGeoJSON.features.push(feature)

    // Save blocks
    await gcsClient.writeJSON(blocksPath, blocksGeoJSON)

    // Update farm metadata
    const farmPath = `farms/${farmId}/metadata.json`
    farm.blockCount = blocksGeoJSON.features.length
    farm.totalArea = blocksGeoJSON.features.reduce(
      (sum: number, f: any) => sum + (f.properties.area || 0),
      0
    )
    farm.updatedAt = now
    await gcsClient.writeJSON(farmPath, farm)

    res.status(201).json(feature)
  } catch (error: any) {
    console.error('Error creating block:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to create block',
    })
  }
})

/**
 * GET /api/farms/:farmId/blocks/:blockId
 * Get a single block
 */
router.get('/farms/:farmId/blocks/:blockId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, blockId } = req.params

    // Check access
    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Read blocks
    const blocksPath = `farms/${farmId}/blocks.json`
    const exists = await gcsClient.exists(blocksPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Block not found',
      })
    }

    const blocksGeoJSON = await gcsClient.readJSON<any>(blocksPath)

    // Find block
    const feature = blocksGeoJSON.features.find((f: any) => f.id === blockId)

    if (!feature) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Block not found',
      })
    }

    res.json(feature)
  } catch (error: any) {
    console.error('Error fetching block:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch block',
    })
  }
})

/**
 * PUT /api/farms/:farmId/blocks/:blockId
 * Update a block
 */
router.put('/farms/:farmId/blocks/:blockId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, blockId } = req.params
    const updates = req.body

    // Check access
    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Read blocks
    const blocksPath = `farms/${farmId}/blocks.json`
    const exists = await gcsClient.exists(blocksPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Block not found',
      })
    }

    const blocksGeoJSON = await gcsClient.readJSON<any>(blocksPath)

    // Find block
    const featureIndex = blocksGeoJSON.features.findIndex((f: any) => f.id === blockId)

    if (featureIndex === -1) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Block not found',
      })
    }

    const feature = blocksGeoJSON.features[featureIndex]
    const originalFeature: Feature = JSON.parse(JSON.stringify(feature))
    const {
      geometry: geometryUpdate,
      revisionMessage,
      ...propertyUpdates
    } = updates

    // Update geometry if provided
    if (geometryUpdate) {
      feature.geometry = geometryUpdate
      feature.properties.area = turf.area(geometryUpdate)
    }

    const nowIso = new Date().toISOString()
    const updatedProperties: Record<string, any> = {
      ...feature.properties,
      ...propertyUpdates,
      id: blockId, // Never allow ID to change
      farmId, // Never allow farmId to change
      geometry: undefined, // Remove geometry from properties
      updatedAt: nowIso,
      updatedBy: userId,
      updatedByName: req.user?.email,
    }

    if (revisionMessage !== undefined) {
      updatedProperties.revisionMessage = revisionMessage
    }

    feature.properties = updatedProperties

    // Capture previous state as revision
    try {
      const revisions = await readBlockRevisions(farmId, blockId)
      const previousProperties = {
        ...(originalFeature.properties as Record<string, any>),
        geometry: undefined,
      }

      const revisionCreatedAt = previousProperties.updatedAt || nowIso
      const revisionRecord: BlockRevision = {
        id: uuidv4(),
        farmId,
        blockId,
        createdAt: revisionCreatedAt,
        geometry: originalFeature.geometry,
        properties: previousProperties as Block,
        revisionMessage: previousProperties.revisionMessage,
        updatedBy: previousProperties.updatedBy || userId,
        updatedByName: previousProperties.updatedByName || req.user?.email,
      }

      revisions.unshift(revisionRecord)
      const limited = revisions.slice(0, 100)
      await writeBlockRevisions(farmId, blockId, limited)
    } catch (revisionError) {
      console.error('Failed to persist block revision:', revisionError)
    }

    // Save blocks
    await gcsClient.writeJSON(blocksPath, blocksGeoJSON)

    // Update farm metadata
    const farmPath = `farms/${farmId}/metadata.json`
    farm.totalArea = blocksGeoJSON.features.reduce(
      (sum: number, f: any) => sum + (f.properties.area || 0),
      0
    )
    farm.updatedAt = new Date().toISOString()
    await gcsClient.writeJSON(farmPath, farm)

    res.json(feature)
  } catch (error: any) {
    console.error('Error updating block:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to update block',
    })
  }
})

/**
 * GET /api/farms/:farmId/blocks/:blockId/revisions
 * Retrieve revision history for a block
 */
router.get('/farms/:farmId/blocks/:blockId/revisions', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, blockId } = req.params

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    const revisions = await readBlockRevisions(farmId, blockId)
    res.json(revisions)
  } catch (error: any) {
    console.error('Error fetching block revisions:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch block revisions',
    })
  }
})

/**
 * POST /api/farms/:farmId/blocks/:blockId/revisions/:revisionId/revert
 * Revert a block to a specific revision
 */
router.post('/farms/:farmId/blocks/:blockId/revisions/:revisionId/revert', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const userEmail = req.user?.email
    const { farmId, blockId, revisionId } = req.params
    const { revisionMessage } = req.body || {}

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    const blocksPath = `farms/${farmId}/blocks.json`
    const exists = await gcsClient.exists(blocksPath)
    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Block not found',
      })
    }

    const blocksGeoJSON = await gcsClient.readJSON<any>(blocksPath)
    const featureIndex = blocksGeoJSON.features.findIndex((f: any) => f.id === blockId)

    if (featureIndex === -1) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Block not found',
      })
    }

    const revisions = await readBlockRevisions(farmId, blockId)
    const revision = revisions.find((r) => r.id === revisionId)

    if (!revision) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Revision not found',
      })
    }

    const nowIso = new Date().toISOString()
    const currentFeature: Feature = JSON.parse(JSON.stringify(blocksGeoJSON.features[featureIndex]))

    // Store current block state as a new revision entry before reverting
    const currentProperties = {
      ...(currentFeature.properties as Record<string, any>),
      geometry: undefined,
    }

    const revertRevision: BlockRevision = {
      id: uuidv4(),
      farmId,
      blockId,
      createdAt: nowIso,
      geometry: currentFeature.geometry,
      properties: currentProperties as Block,
      revisionMessage: revisionMessage
        ? `Reverted to ${revisionId}: ${revisionMessage}`
        : `Reverted to ${revisionId}`,
      updatedBy: userId,
      updatedByName: userEmail,
    }

    revisions.unshift(revertRevision)

    // Apply the selected revision to the block feature
    const feature = blocksGeoJSON.features[featureIndex]
    feature.geometry = revision.geometry as any
    feature.properties = {
      ...revision.properties,
      id: blockId,
      farmId,
      geometry: undefined,
      updatedAt: nowIso,
      updatedBy: userId,
      updatedByName: userEmail,
      revisionMessage: revisionMessage || revision.revisionMessage,
    }

    if (feature.geometry) {
      feature.properties.area = turf.area(feature.geometry as any)
    }

    await gcsClient.writeJSON(blocksPath, blocksGeoJSON)

    // Update farm metadata area totals
    const farmPath = `farms/${farmId}/metadata.json`
    farm.totalArea = blocksGeoJSON.features.reduce(
      (sum: number, f: any) => sum + (f.properties.area || 0),
      0
    )
    farm.updatedAt = nowIso
    await gcsClient.writeJSON(farmPath, farm)

    await writeBlockRevisions(farmId, blockId, revisions.slice(0, 100))

    res.json(feature)
  } catch (error: any) {
    console.error('Error reverting block revision:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to revert block revision',
    })
  }
})

/**
 * DELETE /api/farms/:farmId/blocks/:blockId
 * Delete a block
 */
router.delete('/farms/:farmId/blocks/:blockId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, blockId } = req.params

    // Check access
    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Read blocks
    const blocksPath = `farms/${farmId}/blocks.json`
    const exists = await gcsClient.exists(blocksPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Block not found',
      })
    }

    const blocksGeoJSON = await gcsClient.readJSON<any>(blocksPath)

    // Filter out the block
    const originalLength = blocksGeoJSON.features.length
    blocksGeoJSON.features = blocksGeoJSON.features.filter((f: any) => f.id !== blockId)

    if (blocksGeoJSON.features.length === originalLength) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Block not found',
      })
    }

    // Save blocks
    await gcsClient.writeJSON(blocksPath, blocksGeoJSON)

    // Update farm metadata
    const farmPath = `farms/${farmId}/metadata.json`
    farm.blockCount = blocksGeoJSON.features.length
    farm.totalArea = blocksGeoJSON.features.reduce(
      (sum: number, f: any) => sum + (f.properties.area || 0),
      0
    )
    farm.updatedAt = new Date().toISOString()
    await gcsClient.writeJSON(farmPath, farm)

    res.status(204).send()
  } catch (error: any) {
    console.error('Error deleting block:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to delete block',
    })
  }
})

export default router
