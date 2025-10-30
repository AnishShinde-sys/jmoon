import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { gcsClient } from '../services/gcsClient'
import { Farm, UserProfile } from '../types'

const router = Router()

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const profilePath = `users/${userId}/profile.json`
    const exists = await gcsClient.exists(profilePath)
    if (!exists) {
      return null
    }
    return await gcsClient.readJSON<UserProfile>(profilePath)
  } catch (error) {
    console.error('Failed to read user profile:', error)
    return null
  }
}

async function requireAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId)
  return profile?.role === 'admin'
}

async function listUserProfiles(limit = 500) {
  try {
    const userFiles = await gcsClient.listFiles('users/')
    const profileFiles = userFiles.filter((file) => file.endsWith('/profile.json'))

    const slice = profileFiles.slice(0, limit)
    const users: UserProfile[] = []

    for (const file of slice) {
      try {
        const profile = await gcsClient.readJSON<UserProfile>(file)
        users.push(profile)
      } catch (error) {
        console.warn(`Failed to read profile ${file}:`, error)
      }
    }

    return { profiles: users, total: profileFiles.length }
  } catch (error) {
    console.error('Failed to list user profiles:', error)
    return { profiles: [], total: 0 }
  }
}

async function listFarmMetadata(limit = 200) {
  try {
    const farmFiles = await gcsClient.listFiles('farms/')
    const metadataFiles = farmFiles.filter((file) => file.endsWith('/metadata.json'))
    const slice = metadataFiles.slice(0, limit)

    const farms: Farm[] = []

    for (const file of slice) {
      try {
        const metadata = await gcsClient.readJSON<Farm>(file)
        farms.push(metadata)
      } catch (error) {
        console.warn(`Failed to read farm metadata ${file}:`, error)
      }
    }

    const datasetMetadataFiles = farmFiles.filter(
      (file) => file.includes('/datasets/') && file.endsWith('/metadata.json')
    )

    return {
      farms,
      farmCount: metadataFiles.length,
      datasetCount: datasetMetadataFiles.length,
    }
  } catch (error) {
    console.error('Failed to list farms:', error)
    return { farms: [], farmCount: 0, datasetCount: 0 }
  }
}

router.get('/statistics', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const isAdmin = await requireAdmin(userId)
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      })
    }

    const [{ total: userCount }, { farmCount, datasetCount }] = await Promise.all([
      listUserProfiles(0),
      listFarmMetadata(0),
    ])

    res.json({
      users: userCount,
      farms: farmCount,
      datasets: datasetCount,
      date: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching admin statistics:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to fetch statistics',
    })
  }
})

router.get('/exports/farms-geojson', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const isAdmin = await requireAdmin(userId)
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      })
    }

    const geoJson = await gcsClient.readJSON<any>('statistics/farms/farms.geojson')

    res.json({
      geoJson,
      updatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error exporting farms geojson:', error)
    res.status(500).json({
      error: 'InternalError',
      message: error?.message || 'Failed to export farms map data',
    })
  }
})

router.get('/exports/users.csv', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const isAdmin = await requireAdmin(userId)
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      })
    }

    const { profiles } = await listUserProfiles()

    const header = ['Email', 'First Name', 'Last Name']
    const rows = profiles.map((profile) => [profile.email || '', profile.firstName || '', profile.lastName || ''])

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const cell = String(value ?? '')
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
              return `"${cell.replace(/"/g, '""')}"`
            }
            return cell
          })
          .join(',')
      )
      .join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"')
    res.send(csv)
  } catch (error: any) {
    console.error('Error exporting user CSV:', error)
    res.status(500).json({
      error: 'InternalError',
      message: error?.message || 'Failed to export users CSV',
    })
  }
})

router.post('/script', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const isAdmin = await requireAdmin(userId)
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      })
    }

    const script = String(req.body?.script || '').trim()
    if (!script) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Script is required',
      })
    }

    const sanitized = script.toLowerCase()
    const disallowedKeywords = ['delete', 'remove', 'drop', 'exec', 'eval', 'require', 'import']
    const containsDangerousKeyword = disallowedKeywords.some((keyword) => sanitized.includes(keyword))
    if (containsDangerousKeyword) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Script contains disallowed operations',
      })
    }

    let result: any = null

    if (sanitized.startsWith('list users')) {
      const { profiles, total } = await listUserProfiles()
      result = {
        operation: 'list_users',
        total,
        users: profiles.map((profile) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          createdAt: profile.createdAt,
        })),
      }
    } else if (sanitized.startsWith('list farms')) {
      const { farms, farmCount, datasetCount } = await listFarmMetadata()
      result = {
        operation: 'list_farms',
        total: farmCount,
        datasetCount,
        farms: farms.map((farm) => ({
          id: farm.id,
          name: farm.name,
          owner: farm.owner,
          createdAt: farm.createdAt,
          datasetCount: farm.datasetCount,
          blockCount: farm.blockCount,
        })),
      }
    } else if (sanitized.startsWith('count farms')) {
      const { farmCount } = await listFarmMetadata(0)
      result = {
        operation: 'count_farms',
        total: farmCount,
      }
    } else if (sanitized.startsWith('count datasets')) {
      const { datasetCount } = await listFarmMetadata(0)
      result = {
        operation: 'count_datasets',
        total: datasetCount,
      }
    } else if (sanitized.startsWith('count users')) {
      const { total } = await listUserProfiles(0)
      result = {
        operation: 'count_users',
        total,
      }
    } else {
      return res.status(400).json({
        error: 'UnsupportedCommand',
        message: 'Command not recognised. Try commands like "list users", "list farms", "count datasets".',
      })
    }

    res.json({
      success: true,
      executedAt: new Date().toISOString(),
      result,
    })
  } catch (error) {
    console.error('Error executing admin script:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to execute script',
    })
  }
})

router.get('/users/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const isAdmin = await requireAdmin(userId)
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      })
    }

    const { profiles } = await listUserProfiles()

    const headers = ['Email', 'Name', 'Role', 'Created At']
    const csvRows = [headers.join(',')]

    profiles.forEach((profile) => {
      const email = (profile.email || '').replace(/"/g, '""')
      const name = (profile.name || '').replace(/"/g, '""')
      const role = profile.role || ''
      const createdAt = profile.createdAt || ''
      csvRows.push(`"${email}","${name}","${role}","${createdAt}"`)
    })

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"')
    res.send(csvRows.join('\n'))
  } catch (error) {
    console.error('Error exporting users:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to export users',
    })
  }
})

router.get('/gis/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const isAdmin = await requireAdmin(userId)
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      })
    }

    const { farms } = await listFarmMetadata()

    const features: any[] = []

    for (const farm of farms) {
      const farmId = farm.id
      if (!farmId) {
        continue
      }

      const blocksPath = `farms/${farmId}/blocks.json`
      try {
        const exists = await gcsClient.exists(blocksPath)
        if (!exists) {
          continue
        }

        const blocksGeoJSON = await gcsClient.readJSON<any>(blocksPath)
        if (Array.isArray(blocksGeoJSON?.features)) {
          blocksGeoJSON.features.forEach((feature: any) => {
            features.push({
              ...feature,
              properties: {
                ...feature.properties,
                farmId,
                farmName: farm.name,
              },
            })
          })
        }
      } catch (error) {
        console.warn(`Failed to export blocks for farm ${farmId}:`, error)
      }
    }

    res.json({
      type: 'FeatureCollection',
      features,
    })
  } catch (error) {
    console.error('Error exporting GIS data:', error)
    res.status(500).json({
      error: 'InternalError',
      message: 'Failed to export GIS data',
    })
  }
})

export default router


