import { Storage } from '@google-cloud/storage'

const bucketName = process.env.GCS_BUCKET_NAME
const projectId = process.env.GCP_PROJECT_ID

if (!bucketName) {
  console.warn('⚠️  GCS_BUCKET_NAME not set')
}

// Initialize GCS client
// Uses Application Default Credentials (ADC) by default
// Or GOOGLE_APPLICATION_CREDENTIALS environment variable
const storage = new Storage(projectId ? { projectId } : undefined)

/**
 * GCS Client for reading/writing JSON files
 */
export class GCSClient {
  private bucket

  constructor() {
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME environment variable not set')
    }
    this.bucket = storage.bucket(bucketName)
  }

  /**
   * Read JSON file from GCS
   */
  async readJSON<T>(filePath: string): Promise<T> {
    try {
      const file = this.bucket.file(filePath)
      const [exists] = await file.exists()

      if (!exists) {
        throw new Error(`File not found: ${filePath}`)
      }

      const [contents] = await file.download()
      return JSON.parse(contents.toString('utf-8'))
    } catch (error: any) {
      if (error.code === 404) {
        throw new Error(`File not found: ${filePath}`)
      }
      throw error
    }
  }

  /**
   * Write JSON file to GCS
   */
  async writeJSON(filePath: string, data: any): Promise<void> {
    const file = this.bucket.file(filePath)
    const contents = JSON.stringify(data, null, 2)

    await file.save(contents, {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache',
      },
    })
  }

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    const file = this.bucket.file(filePath)
    const [exists] = await file.exists()
    return exists
  }

  /**
   * Delete file
   */
  async delete(filePath: string): Promise<void> {
    const file = this.bucket.file(filePath)
    await file.delete()
  }

  /**
   * List files with prefix
   */
  async listFiles(prefix: string): Promise<string[]> {
    const [files] = await this.bucket.getFiles({ prefix })
    return files.map((file) => file.name)
  }

  /**
   * Generate signed URL for reading a file
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const file = this.bucket.file(filePath)

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    })

    return url
  }

  /**
   * Upload file from buffer
   */
  async uploadBuffer(filePath: string, buffer: Buffer, contentType: string): Promise<void> {
    const file = this.bucket.file(filePath)

    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=3600',
      },
    })
  }

  /**
   * Copy file
   */
  async copy(sourcePath: string, destPath: string): Promise<void> {
    const sourceFile = this.bucket.file(sourcePath)
    const destFile = this.bucket.file(destPath)

    await sourceFile.copy(destFile)
  }

  /**
   * Get file metadata
   */
  async getMetadata(filePath: string): Promise<any> {
    const file = this.bucket.file(filePath)
    const [metadata] = await file.getMetadata()
    return metadata
  }
}

// Export singleton instance
export const gcsClient = new GCSClient()
export default gcsClient
