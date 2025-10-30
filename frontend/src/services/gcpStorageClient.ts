export interface GcpConfig {
  projectId: string | null
  bucketName: string | null
  signedUrlExpiryMinutes: number
}

export interface InitResponse {
  success: boolean
  access?: {
    name?: string
    location?: string
    storageClass?: string
  }
  config: GcpConfig
  message?: string
}

class GcpStorageClient {
  async getConfig(): Promise<GcpConfig> {
    const response = await fetch('/api/storage/gcp/config', {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('Failed to load GCP configuration')
    }

    const data = await response.json()
    return data.config as GcpConfig
  }

  async initialize(): Promise<InitResponse> {
    const response = await fetch('/api/storage/gcp/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.message ?? 'Failed to initialize GCP Storage')
    }

    return data as InitResponse
  }

  async generateSignedUrl(filePath: string) {
    const response = await fetch('/api/storage/gcp/signed-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePath }),
      cache: 'no-store',
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.message ?? 'Failed to generate signed URL')
    }

    return data.url as string
  }
}

export const gcpStorageClient = new GcpStorageClient()


