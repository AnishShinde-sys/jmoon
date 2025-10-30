import { Router } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { gcsClient } from '../services/gcsClient'
import { checkFarmAccess } from './blocks'
import { pluginsDirectory, findPluginById } from '../data/plugins'
import { Farm } from '../types'

const router = Router()

/**
 * GET /api/plugins
 * Return directory of available plugins
 */
router.get('/plugins', authenticate, (_req: AuthRequest, res) => {
  res.json(pluginsDirectory)
})

/**
 * GET /api/farms/:farmId/plugins
 * Return enabled plugins for a farm
 */
router.get('/farms/:farmId/plugins', authenticate, async (req: AuthRequest, res) => {
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

    res.json({
      enabled: farm.plugins || [],
    })
  } catch (error) {
    console.error('Error fetching farm plugins:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to load farm plugins',
    })
  }
})

/**
 * POST /api/farms/:farmId/plugins/:pluginId
 * Enable or disable a plugin for a farm
 */
router.post('/farms/:farmId/plugins/:pluginId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const userEmail = req.user?.email
    const { farmId, pluginId } = req.params
    const { enabled } = req.body as { enabled?: boolean }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Request body must include boolean "enabled"',
      })
    }

    const plugin = findPluginById(pluginId)
    if (!plugin) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Plugin not found',
      })
    }

    const farmPath = `farms/${farmId}/metadata.json`
    const exists = await gcsClient.exists(farmPath)

    if (!exists) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Farm not found',
      })
    }

    const farm = await gcsClient.readJSON<Farm>(farmPath)

    if (farm.owner !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the farm owner can manage plugins',
      })
    }

    const plugins = new Set(farm.plugins || [])

    if (enabled) {
      plugins.add(pluginId)
    } else {
      plugins.delete(pluginId)
    }

    const updatedFarm: Farm = {
      ...farm,
      plugins: Array.from(plugins),
      updatedAt: new Date().toISOString(),
    }

    await gcsClient.writeJSON(farmPath, updatedFarm)

    res.json({
      enabled: updatedFarm.plugins,
      updatedBy: userEmail,
      updatedAt: updatedFarm.updatedAt,
    })
  } catch (error) {
    console.error('Error updating farm plugins:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to update plugin state',
    })
  }
})

export default router

