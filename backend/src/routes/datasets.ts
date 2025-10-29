import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import { authenticate, AuthRequest } from '../middleware/auth'
import { gcsClient } from '../services/gcsClient'
import { Farm, Dataset, CreateDatasetInput } from '../types'
import { processFile, detectFileType, ProcessingResult } from '../services/fileProcessor'

const router = Router()

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max file size
  },
})

/**
 * Helper: Check if user has access to farm
 */
async function checkFarmAccess(farmId: string, userId: string): Promise<Farm | null> {
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

/**
 * GET /api/farms/:farmId/datasets
 * List all datasets for a farm
 */
router.get('/farms/:farmId/datasets', authenticate, async (req: AuthRequest, res) => {
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

    // List dataset files
    const prefix = `farms/${farmId}/datasets/`
    const files = await gcsClient.listFiles(prefix)

    // Filter metadata files
    const metadataFiles = files.filter((f) => f.endsWith('/metadata.json'))

    // Read all dataset metadata
    const datasets = await Promise.all(
      metadataFiles.map(async (file) => {
        try {
          return await gcsClient.readJSON<Dataset>(file)
        } catch (error) {
          console.error(`Error reading dataset ${file}:`, error)
          return null
        }
      })
    )

    // Filter out failed reads and sort by createdAt
    const validDatasets = (datasets
      .filter((d) => d !== null) as Dataset[])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    res.json(validDatasets)
  } catch (error: any) {
    console.error('Error listing datasets:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to list datasets',
    })
  }
})

/**
 * POST /api/farms/:farmId/datasets/upload
 * Upload a new dataset file
 */
router.post(
  '/farms/:farmId/datasets/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id
      const { farmId } = req.params

      if (!req.file) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'No file uploaded',
        })
      }

      // Check access
      const farm = await checkFarmAccess(farmId, userId)
      if (!farm) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'Farm not found or access denied',
        })
      }

      // Parse metadata from form
      const input: CreateDatasetInput = {
        name: req.body.name || req.file.originalname,
        type: req.body.type || 'geojson',
        description: req.body.description,
        collectedAt: req.body.collectedAt,
        collectorId: req.body.collectorId,
      }

      // Create dataset ID
      const datasetId = uuidv4()
      const now = new Date().toISOString()

      // Determine file extension
      const ext = req.file.originalname.split('.').pop() || 'dat'

      // Upload raw file to GCS
      const rawFilePath = `farms/${farmId}/datasets/${datasetId}/raw.${ext}`
      await gcsClient.uploadBuffer(
        rawFilePath,
        req.file.buffer,
        req.file.mimetype
      )

      // Process file and generate GeoJSON
      let processingResult: ProcessingResult | null = null
      let processedFilePath: string | null = null
      
      try {
        const fileType = detectFileType(req.file.buffer, req.file.originalname)
        
        if (fileType === 'tiff') {
          // Handle TIFF files specially - convert to JPG
          const ImageProcessor = await import('../services/imageProcessor')
          const jpgBuffer = await ImageProcessor.processTIFF(req.file.buffer)
          const jpgPath = `farms/${farmId}/datasets/${datasetId}/processed.jpg`
          await gcsClient.uploadBuffer(jpgPath, jpgBuffer, 'image/jpeg')
          
          // Create dataset metadata for TIFF
          const dataset: Dataset = {
            id: datasetId,
            farmId,
            name: input.name,
            type: 'raster',
            description: input.description,
            status: 'completed',
            uploadedBy: userId,
            collectedAt: input.collectedAt || now,
            collectorId: input.collectorId,
            createdAt: now,
            updatedAt: now,
            fileSize: req.file.size,
            originalFilename: req.file.originalname,
            rasterPath: jpgPath,
          }
          
          const metadataPath = `farms/${farmId}/datasets/${datasetId}/metadata.json`
          await gcsClient.writeJSON(metadataPath, dataset)
          
          // Update farm metadata
          const farmPath = `farms/${farmId}/metadata.json`
          farm.datasetCount = (farm.datasetCount || 0) + 1
          farm.updatedAt = now
          await gcsClient.writeJSON(farmPath, farm)
          
          return res.status(201).json(dataset)
        }
        
        // Process vector files to GeoJSON
        processingResult = await processFile(req.file.buffer, req.file.originalname)
        
        // Upload processed GeoJSON
        const geojsonBuffer = Buffer.from(JSON.stringify(processingResult.geojson))
        processedFilePath = `farms/${farmId}/datasets/${datasetId}/processed.geojson`
        await gcsClient.uploadBuffer(
          processedFilePath,
          geojsonBuffer,
          'application/json'
        )
      } catch (processingError: any) {
        console.error('File processing error:', processingError)
        // Continue with metadata creation even if processing fails
      }

      // Create dataset metadata
      const dataset: Dataset = {
        id: datasetId,
        farmId,
        name: input.name,
        type: input.type,
        description: input.description,
        status: processingResult ? 'completed' : 'failed',
        uploadedBy: userId,
        collectedAt: input.collectedAt || now,
        collectorId: input.collectorId,
        createdAt: now,
        updatedAt: now,
        fileSize: req.file.size,
        originalFilename: req.file.originalname,
        ...(processingResult && {
          recordCount: processingResult.recordCount,
          bounds: processingResult.bounds,
          fields: processingResult.fields,
          geojsonPath: processedFilePath,
        }),
      }

      // Save metadata
      const metadataPath = `farms/${farmId}/datasets/${datasetId}/metadata.json`
      await gcsClient.writeJSON(metadataPath, dataset)

      // Update farm metadata
      const farmPath = `farms/${farmId}/metadata.json`
      farm.datasetCount = (farm.datasetCount || 0) + 1
      farm.updatedAt = now
      await gcsClient.writeJSON(farmPath, farm)

      res.status(201).json(dataset)
    } catch (error: any) {
      console.error('Error uploading dataset:', error)
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to upload dataset',
      })
    }
  }
)

/**
 * GET /api/datasets/:datasetId
 * Get dataset details with processed GeoJSON
 */
router.get('/datasets/:datasetId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { datasetId } = req.params

    // Find dataset metadata (we need to search across farms)
    // In production, you might want to maintain a dataset index
    const { farmId } = req.query

    if (!farmId || typeof farmId !== 'string') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'farmId query parameter is required',
      })
    }

    // Check access to farm
    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Read dataset metadata
    const metadataPath = `farms/${farmId}/datasets/${datasetId}/metadata.json`
    const exists = await gcsClient.exists(metadataPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Dataset not found',
      })
    }

    const dataset = await gcsClient.readJSON<Dataset>(metadataPath)

    // If dataset is processed, include GeoJSON
    if (dataset.status === 'completed') {
      const geojsonPath = `farms/${farmId}/datasets/${datasetId}/processed.geojson`
      const geojsonExists = await gcsClient.exists(geojsonPath)

      if (geojsonExists) {
        const geojson = await gcsClient.readJSON(geojsonPath)
        return res.json({
          ...dataset,
          geojson,
        })
      }
    }

    res.json(dataset)
  } catch (error: any) {
    console.error('Error fetching dataset:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch dataset',
    })
  }
})

/**
 * PUT /api/datasets/:datasetId
 * Update dataset metadata
 */
router.put('/datasets/:datasetId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { datasetId } = req.params
    const updates = req.body

    // Need farmId to locate dataset
    const { farmId } = req.query

    if (!farmId || typeof farmId !== 'string') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'farmId query parameter is required',
      })
    }

    // Check access
    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Read dataset metadata
    const metadataPath = `farms/${farmId}/datasets/${datasetId}/metadata.json`
    const exists = await gcsClient.exists(metadataPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Dataset not found',
      })
    }

    const dataset = await gcsClient.readJSON<Dataset>(metadataPath)

    // Update dataset
    const updatedDataset: Dataset = {
      ...dataset,
      ...updates,
      id: datasetId, // Never allow ID to change
      farmId, // Never allow farmId to change
      updatedAt: new Date().toISOString(),
    }

    await gcsClient.writeJSON(metadataPath, updatedDataset)
    res.json(updatedDataset)
  } catch (error: any) {
    console.error('Error updating dataset:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to update dataset',
    })
  }
})

/**
 * DELETE /api/datasets/:datasetId
 * Delete dataset
 */
router.delete('/datasets/:datasetId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { datasetId } = req.params

    // Need farmId to locate dataset
    const { farmId } = req.query

    if (!farmId || typeof farmId !== 'string') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'farmId query parameter is required',
      })
    }

    // Check access
    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    // Check if dataset exists
    const metadataPath = `farms/${farmId}/datasets/${datasetId}/metadata.json`
    const exists = await gcsClient.exists(metadataPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Dataset not found',
      })
    }

    // Delete all dataset files
    const prefix = `farms/${farmId}/datasets/${datasetId}/`
    const files = await gcsClient.listFiles(prefix)

    await Promise.all(
      files.map(async (file) => {
        try {
          await gcsClient.delete(file)
        } catch (error) {
          console.error(`Error deleting ${file}:`, error)
        }
      })
    )

    // Update farm metadata
    const farmPath = `farms/${farmId}/metadata.json`
    farm.datasetCount = Math.max((farm.datasetCount || 1) - 1, 0)
    farm.updatedAt = new Date().toISOString()
    await gcsClient.writeJSON(farmPath, farm)

    res.status(204).send()
  } catch (error: any) {
    console.error('Error deleting dataset:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to delete dataset',
    })
  }
})

export default router
