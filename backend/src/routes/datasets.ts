import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import { authenticate, AuthRequest } from '../middleware/auth'
import { gcsClient } from '../services/gcsClient'
import { Farm, Dataset, CreateDatasetInput, DatasetFolder, DatasetRevision } from '../types'
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

function getDatasetFoldersPath(farmId: string) {
  return `farms/${farmId}/dataset-folders.json`
}

function getDatasetRevisionsPath(farmId: string, datasetId: string) {
  return `farms/${farmId}/datasets/${datasetId}/revisions.json`
}

function userHasWriteAccess(farm: Farm, userId: string): boolean {
  if (farm.owner === userId) return true
  if (farm.collaborators?.some((c) => c.userId === userId && c.role !== 'viewer')) return true
  if (farm.permissions && typeof farm.permissions[userId] === 'string') {
    return farm.permissions[userId] !== 'viewer'
  }
  return false
}

async function readDatasetFolders(farmId: string): Promise<DatasetFolder[]> {
  const path = getDatasetFoldersPath(farmId)
  const exists = await gcsClient.exists(path)
  if (!exists) {
    return []
  }
  try {
    const folders = await gcsClient.readJSON<DatasetFolder[]>(path)
    return Array.isArray(folders) ? folders : []
  } catch (error) {
    console.error('Error reading dataset folders:', error)
    return []
  }
}

async function writeDatasetFolders(farmId: string, folders: DatasetFolder[]): Promise<void> {
  const path = getDatasetFoldersPath(farmId)
  await gcsClient.writeJSON(path, folders)
}

async function appendDatasetRevision(
  farmId: string,
  datasetId: string,
  snapshot: Dataset,
  updatedBy: { id: string; email?: string },
  message?: string
) {
  try {
    const path = getDatasetRevisionsPath(farmId, datasetId)
    let revisions: DatasetRevision[] = []
    if (await gcsClient.exists(path)) {
      revisions = await gcsClient.readJSON<DatasetRevision[]>(path)
    }

    const revision: DatasetRevision = {
      id: uuidv4(),
      datasetId,
      farmId,
      createdAt: new Date().toISOString(),
      updatedBy: updatedBy.id,
      updatedByName: updatedBy.email,
      snapshot,
      revisionMessage: message,
    }

    revisions.unshift(revision)
    if (revisions.length > 50) {
      revisions = revisions.slice(0, 50)
    }

    await gcsClient.writeJSON(path, revisions)
  } catch (error) {
    console.error('Failed to append dataset revision:', error)
  }
}

async function reassignDatasetsForFolder(farmId: string, folderId: string) {
  const prefix = `farms/${farmId}/datasets/`
  const files = await gcsClient.listFiles(prefix)
  const metadataFiles = files.filter((f) => f.endsWith('/metadata.json'))

  await Promise.all(
    metadataFiles.map(async (file) => {
      try {
        const dataset = await gcsClient.readJSON<Dataset>(file)
        const currentFolder = dataset.folderId || 'root'
        if (currentFolder === folderId) {
          dataset.folderId = 'root'
          dataset.updatedAt = new Date().toISOString()
          await gcsClient.writeJSON(file, dataset)
        }
      } catch (error) {
        console.error(`Error reassigning dataset ${file}:`, error)
      }
    })
  )
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

    const folderIdParam = typeof req.query.folderId === 'string' ? req.query.folderId : undefined
    const filteredDatasets = folderIdParam
      ? validDatasets.filter((dataset) => {
          const folderId = dataset.folderId || 'root'
          return folderId === folderIdParam
        })
      : validDatasets

    res.json(filteredDatasets)
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

      if (!userHasWriteAccess(farm, userId)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to upload datasets for this farm',
        })
      }

      // Parse metadata from form
      let columnMapping: Record<string, string> | undefined
      let originalHeaders: string[] | undefined

      if (req.body.columnMapping) {
        try {
          const parsed = JSON.parse(req.body.columnMapping)
          if (parsed && typeof parsed === 'object') {
            columnMapping = parsed
          }
        } catch (error) {
          console.warn('Invalid columnMapping payload, ignoring.')
        }
      }

      if (req.body.originalHeaders) {
        try {
          const parsedHeaders = JSON.parse(req.body.originalHeaders)
          if (Array.isArray(parsedHeaders)) {
            originalHeaders = parsedHeaders
          }
        } catch (error) {
          console.warn('Invalid originalHeaders payload, ignoring.')
        }
      }

      const folderId = req.body.folderId || 'root'

      const input: CreateDatasetInput = {
        name: req.body.name || req.file.originalname,
        type: req.body.type || 'geojson',
        description: req.body.description,
        collectedAt: req.body.collectedAt,
        collectorId: req.body.collectorId,
        folderId,
        columnMapping,
        originalHeaders,
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
            folderId,
            columnMapping,
            originalHeaders,
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
        folderId,
        columnMapping,
        originalHeaders,
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

    if (!userHasWriteAccess(farm, userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update datasets for this farm',
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
    const { revisionMessage } = updates

    let parsedColumnMapping: Record<string, string> | undefined
    if (typeof updates.columnMapping === 'string') {
      try {
        parsedColumnMapping = JSON.parse(updates.columnMapping)
      } catch (error) {
        console.warn('Invalid columnMapping payload on update, ignoring.')
      }
    } else if (updates.columnMapping && typeof updates.columnMapping === 'object') {
      parsedColumnMapping = updates.columnMapping
    }

    let parsedHeaders: string[] | undefined
    if (typeof updates.originalHeaders === 'string') {
      try {
        const parsed = JSON.parse(updates.originalHeaders)
        if (Array.isArray(parsed)) {
          parsedHeaders = parsed
        }
      } catch (error) {
        console.warn('Invalid originalHeaders payload on update, ignoring.')
      }
    } else if (Array.isArray(updates.originalHeaders)) {
      parsedHeaders = updates.originalHeaders
    }

    delete updates.columnMapping
    delete updates.originalHeaders

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

    if (!userHasWriteAccess(farm, userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete datasets for this farm',
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

    await appendDatasetRevision(farmId, datasetId, dataset, { id: userId, email: req.user?.email }, revisionMessage)

    const sanitizedUpdates: Partial<Dataset> = { ...updates }
    delete (sanitizedUpdates as any).revisionMessage

    const resolvedFolderId = (sanitizedUpdates.folderId ?? dataset.folderId) || 'root'

    const updatedDataset: Dataset = {
      ...dataset,
      ...sanitizedUpdates,
      id: datasetId, // Never allow ID to change
      farmId, // Never allow farmId to change
      updatedAt: new Date().toISOString(),
      folderId: resolvedFolderId,
      columnMapping: parsedColumnMapping ?? dataset.columnMapping,
      originalHeaders: parsedHeaders ?? dataset.originalHeaders,
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

/**
 * GET /api/farms/:farmId/datasets/:datasetId/revisions
 * Return revision history for a dataset
 */
router.get('/farms/:farmId/datasets/:datasetId/revisions', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, datasetId } = req.params

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    const revisionsPath = getDatasetRevisionsPath(farmId, datasetId)
    const exists = await gcsClient.exists(revisionsPath)

    if (!exists) {
      return res.json([])
    }

    const revisions = await gcsClient.readJSON<DatasetRevision[]>(revisionsPath)
    res.json(revisions)
  } catch (error: any) {
    console.error('Error fetching dataset revisions:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch dataset revisions',
    })
  }
})

/**
 * Dataset folder management endpoints
 */
router.get('/farms/:farmId/dataset-folders', authenticate, async (req: AuthRequest, res) => {
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

    const folders = await readDatasetFolders(farmId)
    res.json(folders)
  } catch (error: any) {
    console.error('Error fetching dataset folders:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch dataset folders',
    })
  }
})

router.post('/farms/:farmId/dataset-folders', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId } = req.params
    const { name, description, parentId } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Folder name is required',
      })
    }

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    if (!userHasWriteAccess(farm, userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to manage dataset folders for this farm',
      })
    }

    const folders = await readDatasetFolders(farmId)
    const now = new Date().toISOString()
    const folder: DatasetFolder = {
      id: uuidv4(),
      farmId,
      name: name.trim(),
      description: description?.trim() || undefined,
      parentId: parentId || 'root',
      createdAt: now,
      updatedAt: now,
    }

    folders.push(folder)
    await writeDatasetFolders(farmId, folders)

    res.status(201).json(folder)
  } catch (error: any) {
    console.error('Error creating dataset folder:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to create dataset folder',
    })
  }
})

router.put('/farms/:farmId/dataset-folders/:folderId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, folderId } = req.params
    const { name, description, parentId } = req.body

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    if (!userHasWriteAccess(farm, userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to manage dataset folders for this farm',
      })
    }

    const folders = await readDatasetFolders(farmId)
    const index = folders.findIndex((folder) => folder.id === folderId)

    if (index === -1) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Folder not found',
      })
    }

    const updatedFolder: DatasetFolder = {
      ...folders[index],
      name: name ? name.trim() : folders[index].name,
      description: description !== undefined ? description.trim() : folders[index].description,
      parentId: parentId || folders[index].parentId,
      updatedAt: new Date().toISOString(),
    }

    folders[index] = updatedFolder
    await writeDatasetFolders(farmId, folders)

    res.json(updatedFolder)
  } catch (error: any) {
    console.error('Error updating dataset folder:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to update dataset folder',
    })
  }
})

router.delete('/farms/:farmId/dataset-folders/:folderId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { farmId, folderId } = req.params

    const farm = await checkFarmAccess(farmId, userId)
    if (!farm) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found or access denied',
      })
    }

    if (!userHasWriteAccess(farm, userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to manage dataset folders for this farm',
      })
    }

    const folders = await readDatasetFolders(farmId)
    const index = folders.findIndex((folder) => folder.id === folderId)

    if (index === -1) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Folder not found',
      })
    }

    folders.splice(index, 1)
    await writeDatasetFolders(farmId, folders)
    await reassignDatasetsForFolder(farmId, folderId)

    res.status(204).send()
  } catch (error: any) {
    console.error('Error deleting dataset folder:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to delete dataset folder',
    })
  }
})

export default router
