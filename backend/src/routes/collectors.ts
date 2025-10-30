import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, AuthRequest } from '../middleware/auth'
import { gcsClient } from '../services/gcsClient'
import { checkFarmAccess } from './blocks'
import { Collector, CreateCollectorInput, DataPoint, CreateDataPointInput } from '../types'

const router = Router()

/**
 * GET /api/farms/:farmId/collectors
 * List all collectors for a farm
 */
router.get('/farms/:farmId/collectors', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // List collector files
    const prefix = `farms/${farmId}/collectors/`
    const files = await gcsClient.listFiles(prefix)

    // Filter metadata files
    const metadataFiles = files.filter((f) => f.endsWith('/metadata.json'))

    // Read all collector metadata
    const collectors = await Promise.all(
      metadataFiles.map(async (file) => {
        try {
          return await gcsClient.readJSON<Collector>(file)
        } catch (error) {
          console.error(`Error reading collector ${file}:`, error)
          return null
        }
      })
    )

    // Filter out failed reads and sort by createdAt
    const validCollectors = (collectors
      .filter((c) => c !== null) as Collector[])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    res.json(validCollectors)
  } catch (error: any) {
    console.error('Error listing collectors:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to list collectors',
    })
  }
})

/**
 * POST /api/farms/:farmId/collectors
 * Create a new collector
 */
router.post('/farms/:farmId/collectors', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params
    const input: CreateCollectorInput = req.body

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Validate required fields
    if (!input.name || !input.fields || input.fields.length === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Collector name and at least one field are required',
      })
    }

    // Create collector
    const collectorId = uuidv4()
    const now = new Date().toISOString()

    const collector: Collector = {
      id: collectorId,
      farmId,
      name: input.name,
      description: input.description,
      fields: input.fields,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    }

    // Save collector metadata
    const collectorPath = `farms/${farmId}/collectors/${collectorId}/metadata.json`
    await gcsClient.writeJSON(collectorPath, collector)

    // Initialize empty data points file
    const dataPointsPath = `farms/${farmId}/collectors/${collectorId}/datapoints.json`
    await gcsClient.writeJSON(dataPointsPath, [])

    res.status(201).json(collector)
  } catch (error: any) {
    console.error('Error creating collector:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to create collector',
    })
  }
})

/**
 * GET /api/farms/:farmId/collectors/:collectorId
 * Get collector details
 */
router.get('/farms/:farmId/collectors/:collectorId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, collectorId } = req.params

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    const collectorPath = `farms/${farmId}/collectors/${collectorId}/metadata.json`
    const exists = await gcsClient.exists(collectorPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Collector not found',
      })
    }

    const collector = await gcsClient.readJSON<Collector>(collectorPath)
    res.json(collector)
  } catch (error: any) {
    console.error('Error fetching collector:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch collector',
    })
  }
})

/**
 * PUT /api/farms/:farmId/collectors/:collectorId
 * Update collector
 */
router.put('/farms/:farmId/collectors/:collectorId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, collectorId } = req.params
    const updates = req.body

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    const collectorPath = `farms/${farmId}/collectors/${collectorId}/metadata.json`
    const exists = await gcsClient.exists(collectorPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Collector not found',
      })
    }

    const collector = await gcsClient.readJSON<Collector>(collectorPath)

    // Check if user can edit (owner or in editors list)
    if (collector.createdBy !== userId && !(collector.editors || []).includes(userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to edit this collector',
      })
    }

    const updatedCollector: Collector = {
      ...collector,
      ...updates,
      id: collectorId, // Never allow ID to change
      farmId, // Never allow farmId to change
      createdBy: collector.createdBy, // Never allow createdBy to change
      updatedAt: new Date().toISOString(),
    }

    await gcsClient.writeJSON(collectorPath, updatedCollector)
    res.json(updatedCollector)
  } catch (error: any) {
    console.error('Error updating collector:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to update collector',
    })
  }
})

/**
 * POST /api/farms/:farmId/collectors/:collectorId/datapoints
 * Create a new data point
 */
router.post('/farms/:farmId/collectors/:collectorId/datapoints', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, collectorId } = req.params
    const input: CreateDataPointInput = req.body

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Validate required fields
    if (!input.geolocation || !input.geolocation.latitude || !input.geolocation.longitude) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Geolocation with latitude and longitude is required',
      })
    }

    // Check if collector exists
    const collectorPath = `farms/${farmId}/collectors/${collectorId}/metadata.json`
    const collectorExists = await gcsClient.exists(collectorPath)

    if (!collectorExists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Collector not found',
      })
    }

    const collector = await gcsClient.readJSON<Collector>(collectorPath)

    // Check if user can add data points (owner or in editors list)
    if (collector.createdBy !== userId && !(collector.editors || []).includes(userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to add data points to this collector',
      })
    }

    // Create data point
    const dataPointId = uuidv4()
    const now = new Date().toISOString()

    const dataPoint: DataPoint = {
      id: dataPointId,
      collectorId,
      geolocation: input.geolocation,
      ...input,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    }

    // Read existing data points
    const dataPointsPath = `farms/${farmId}/collectors/${collectorId}/datapoints.json`
    let dataPoints: DataPoint[] = []

    const dataPointsExist = await gcsClient.exists(dataPointsPath)
    if (dataPointsExist) {
      dataPoints = await gcsClient.readJSON<DataPoint[]>(dataPointsPath)
    }

    // Add new data point
    dataPoints.push(dataPoint)

    // Save data points
    await gcsClient.writeJSON(dataPointsPath, dataPoints)

    // Update collector metadata
    collector.updatedAt = now
    await gcsClient.writeJSON(collectorPath, collector)

    res.status(201).json(dataPoint)
  } catch (error: any) {
    console.error('Error creating data point:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to create data point',
    })
  }
})

/**
 * GET /api/farms/:farmId/collectors/:collectorId/datapoints
 * List all data points for a collector
 */
router.get('/farms/:farmId/collectors/:collectorId/datapoints', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, collectorId } = req.params

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    const dataPointsPath = `farms/${farmId}/collectors/${collectorId}/datapoints.json`
    const exists = await gcsClient.exists(dataPointsPath)

    if (!exists) {
      return res.json([])
    }

    const dataPoints = await gcsClient.readJSON<DataPoint[]>(dataPointsPath)
    res.json(dataPoints)
  } catch (error: any) {
    console.error('Error fetching data points:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch data points',
    })
  }
})

/**
 * GET /api/farms/:farmId/collectors/:collectorId/datapoints/:dataPointId
 * Get a single data point
 */
router.get('/farms/:farmId/collectors/:collectorId/datapoints/:dataPointId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, collectorId, dataPointId } = req.params

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    const dataPointsPath = `farms/${farmId}/collectors/${collectorId}/datapoints.json`
    const exists = await gcsClient.exists(dataPointsPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Data point not found',
      })
    }

    const dataPoints = await gcsClient.readJSON<DataPoint[]>(dataPointsPath)
    const dataPoint = dataPoints.find((dp) => dp.id === dataPointId)

    if (!dataPoint) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Data point not found',
      })
    }

    res.json(dataPoint)
  } catch (error: any) {
    console.error('Error fetching data point:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch data point',
    })
  }
})

export default router
