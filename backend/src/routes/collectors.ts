import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, AuthRequest } from '../middleware/auth'
import { gcsClient } from '../services/gcsClient'
import { checkFarmAccess } from './blocks'
import { Collector, CreateCollectorInput, DataPoint, CreateDataPointInput, Dataset, Farm } from '../types'
import { notifyUsers } from '../services/notificationService'

const router = Router()

async function findDatasetForCollector(
  farmId: string,
  collectorId: string
): Promise<{ dataset: Dataset; metadataPath: string } | null> {
  try {
    const prefix = `farms/${farmId}/datasets/`
    const files = await gcsClient.listFiles(prefix)
    const metadataFiles = files.filter((file) => file.endsWith('/metadata.json'))

    for (const file of metadataFiles) {
      try {
        const candidate = await gcsClient.readJSON<Dataset>(file)
        if (candidate.collectorId === collectorId) {
          return { dataset: candidate, metadataPath: file }
        }
      } catch (error) {
        console.error(`Failed to inspect dataset ${file} while resolving collector link:`, error)
      }
    }
  } catch (error) {
    console.error('Failed to list datasets for collector lookup:', error)
  }

  return null
}

function gatherNotificationRecipients(farm: Farm, dataset?: Dataset | null, collector?: Collector | null) {
  const recipients = new Set<string>()
  if (dataset) {
    if (dataset.createdBy) recipients.add(dataset.createdBy)
    if ((dataset as any).updatedBy) recipients.add((dataset as any).updatedBy)
    if ((dataset as any).ownerId) recipients.add((dataset as any).ownerId)
    if (Array.isArray((dataset as any).editors)) {
      ;((dataset as any).editors as string[]).forEach((id) => id && recipients.add(id))
    }
    if (Array.isArray((dataset as any).collaborators)) {
      ;((dataset as any).collaborators as Array<{ userId?: string }>).forEach((collaborator) => {
        if (collaborator?.userId) recipients.add(collaborator.userId)
      })
    }
  }
  if (collector && collector.createdBy) recipients.add(collector.createdBy)
  if (farm.owner) recipients.add(farm.owner)
  farm.collaborators?.forEach((collaborator) => {
    if (collaborator.role !== 'viewer') {
      recipients.add(collaborator.userId)
    }
  })
  return Array.from(recipients)
}

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

    const normalizedCollectors = validCollectors.map((collector) => ({
      ...collector,
      reCompile: Boolean(collector.reCompile),
    }))

    res.json(normalizedCollectors)
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
      reCompile: false,
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

    // Flag linked dataset for recompilation
    let datasetMetadataPath: string | null = null
    let datasetMetadata: Dataset | null = null

    if (collector.datasetId) {
      const candidatePath = `farms/${farmId}/datasets/${collector.datasetId}/metadata.json`
      if (await gcsClient.exists(candidatePath)) {
        datasetMetadataPath = candidatePath
        datasetMetadata = await gcsClient.readJSON<Dataset>(candidatePath)
      }
    }

    if (!datasetMetadataPath) {
      const match = await findDatasetForCollector(farmId, collectorId)
      if (match) {
        datasetMetadataPath = match.metadataPath
        datasetMetadata = match.dataset
        collector.datasetId = match.dataset.id
      }
    }

    if (datasetMetadata && datasetMetadataPath) {
      const previousStatus = datasetMetadata.processing?.status
      datasetMetadata.dynamic = true
      datasetMetadata.collectorId = collectorId
      datasetMetadata.updatedAt = now
      datasetMetadata.recordCount = dataPoints.length
      datasetMetadata.processing = {
        status: 'pending',
        updatedAt: now,
        message: 'New readings captured. Rebuild to refresh this dataset.',
      }
      await gcsClient.writeJSON(datasetMetadataPath, datasetMetadata)

      if (previousStatus !== 'pending') {
        const recipients = gatherNotificationRecipients(farm, datasetMetadata, collector).filter(
          (id) => id && id !== userId
        )
        if (recipients.length > 0) {
          await notifyUsers(recipients, {
            message: `New readings from ${collector.name ?? 'collector'} are ready to be merged into "${
              datasetMetadata.name ?? 'dataset'
            }".`,
            type: 'warning',
            url: `/app/farm/${farmId}?drawer=datasets&datasetId=${datasetMetadata.id}`,
            metadata: {
              farmId,
              datasetId: datasetMetadata.id,
              collectorId,
              status: 'pending',
              updatedAt: now,
            },
          })
        }
      }
    }

    // Update collector metadata
    collector.updatedAt = now
    collector.reCompile = true
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
