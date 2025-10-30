import { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface AWSStorageConfig {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucketName: string
}

interface SignedUrlOptions {
  expiresIn?: number
}

interface CachedEntry {
  url: string
  timestamp: number
}

export interface ListedFile {
  key: string
  size?: number
  lastModified?: Date
  etag?: string
}

export interface CacheStats {
  size: number
  maxSize: number
  expiryTime: number
}

class AWSStorageService {
  private client: S3Client | null = null
  private bucketName: string | null = null
  private cache = new Map<string, CachedEntry>()
  private readonly cacheExpiry = 50 * 60 * 1000 // 50 minutes
  private readonly maxCacheSize = 200

  initialize(config: AWSStorageConfig): boolean {
    const { accessKeyId, secretAccessKey, region, bucketName } = config

    if (!accessKeyId || !secretAccessKey || !bucketName || !region) {
      throw new Error('Missing required AWS configuration values')
    }

    try {
      this.client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })

      this.bucketName = bucketName
      this.cache.clear()

      return true
    } catch (error: any) {
      this.client = null
      this.bucketName = null
      throw new Error(error?.message || 'Failed to initialize AWS S3 client')
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.bucketName)
  }

  async generateSignedUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    if (!this.isConfigured() || !this.client || !this.bucketName) {
      throw new Error('AWS Storage Service not initialized')
    }

    const cleanKey = key.startsWith('/') ? key.substring(1) : key
    const cacheKey = `signed-url-${cleanKey}`

    this.cache.delete(cacheKey)

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: cleanKey,
    })

    const url = await getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn ?? 300,
    })

    this.cacheSignedUrl(cacheKey, url)
    return url
  }

  async listFiles(prefix = '', maxKeys = 1000): Promise<ListedFile[]> {
    if (!this.isConfigured() || !this.client || !this.bucketName) {
      throw new Error('AWS Storage Service not initialized')
    }

    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys,
    })

    const result = await this.client.send(command)

    return (result.Contents || []).map((obj) => ({
      key: obj.Key ?? '',
      size: obj.Size,
      lastModified: obj.LastModified,
      etag: obj.ETag,
    }))
  }

  async fileExists(key: string): Promise<boolean> {
    if (!this.isConfigured() || !this.client || !this.bucketName) {
      return false
    }

    const cleanKey = key.startsWith('/') ? key.substring(1) : key

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      })

      await this.client.send(command)
      return true
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') {
        return false
      }
      throw new Error(error?.message || 'Failed to check file existence')
    }
  }

  async getFileMetadata(key: string): Promise<ListedFile> {
    if (!this.isConfigured() || !this.client || !this.bucketName) {
      throw new Error('AWS Storage Service not initialized')
    }

    const cleanKey = key.startsWith('/') ? key.substring(1) : key

    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: cleanKey,
    })

    const metadata = await this.client.send(command)

    return {
      key: cleanKey,
      size: metadata.ContentLength,
      lastModified: metadata.LastModified,
      etag: metadata.ETag,
    }
  }

  clearCache() {
    this.cache.clear()
  }

  getCacheStats(): CacheStats {
    this.cleanupCache()
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      expiryTime: this.cacheExpiry,
    }
  }

  private cacheSignedUrl(cacheKey: string, url: string) {
    this.cache.set(cacheKey, {
      url,
      timestamp: Date.now(),
    })

    this.cleanupCache()
  }

  private cleanupCache() {
    const now = Date.now()

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheExpiry) {
        this.cache.delete(key)
      }
    }

    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)
      const toRemove = this.cache.size - this.maxCacheSize

      for (let i = 0; i < toRemove; i += 1) {
        this.cache.delete(entries[i][0])
      }
    }
  }
}

export const awsStorageService = new AWSStorageService()

