import { Storage, Bucket } from '@google-cloud/storage'

const projectId = process.env.GCP_PROJECT_ID
const bucketName = process.env.GCS_BUCKET_NAME
const defaultExpiryMinutes = Number(process.env.GCS_SIGNED_URL_EXPIRY_MINUTES ?? '15')

let storageInstance: Storage | null = null
let bucketInstance: Bucket | null = null

const getStorage = () => {
  if (storageInstance) {
    return storageInstance
  }

  storageInstance = projectId ? new Storage({ projectId }) : new Storage()
  return storageInstance
}

const getBucket = (): Bucket => {
  if (bucketInstance) {
    return bucketInstance
  }

  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set')
  }

  const storage = getStorage()
  bucketInstance = storage.bucket(bucketName)
  return bucketInstance
}

export const getGcpConfig = () => ({
  projectId: projectId ?? null,
  bucketName: bucketName ?? null,
  signedUrlExpiryMinutes: defaultExpiryMinutes,
})

export const verifyBucketAccess = async () => {
  const bucket = getBucket()
  const [metadata] = await bucket.getMetadata()
  return {
    name: metadata.name,
    location: metadata.location,
    storageClass: metadata.storageClass,
  }
}

export const generateSignedUrl = async (filePath: string, expiresInMinutes?: number) => {
  if (!filePath) {
    throw new Error('File path is required to generate a signed URL')
  }

  const bucket = getBucket()
  const file = bucket.file(filePath.startsWith('/') ? filePath.slice(1) : filePath)

  const expires = Date.now() + 1000 * 60 * (expiresInMinutes ?? defaultExpiryMinutes)

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires,
  })

  return url
}

