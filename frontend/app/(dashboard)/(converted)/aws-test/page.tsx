'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Spinner from '@/components/ui/Spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUI } from '@/context/UIContext'
import { awsStorageService, AWSStorageConfig, ListedFile, CacheStats } from '@/services/awsStorageService'

interface AWSStatus {
  initialized: boolean
  error: string | null
}

interface SignedUrlResult {
  url: string | null
  error: string | null
}

interface FileExistsResult {
  checked: boolean
  exists: boolean
}

const REGION_OPTIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
]

const DEFAULT_CONFIG: AWSStorageConfig = {
  accessKeyId: '',
  secretAccessKey: '',
  region: 'us-west-2',
  bucketName: '',
}

export default function AwsTestPage() {
  const router = useRouter()
  const { showAlert } = useUI()

  const [awsConfig, setAwsConfig] = useState<AWSStorageConfig>(DEFAULT_CONFIG)
  const [awsStatus, setAwsStatus] = useState<AWSStatus>({ initialized: false, error: null })
  const [initializing, setInitializing] = useState(false)

  const [fileKey, setFileKey] = useState('images/vineyard/sample.jpg')
  const [signedUrlResult, setSignedUrlResult] = useState<SignedUrlResult>({ url: null, error: null })
  const [generatingUrl, setGeneratingUrl] = useState(false)

  const [listPrefix, setListPrefix] = useState('images/')
  const [fileList, setFileList] = useState<ListedFile[]>([])
  const [listing, setListing] = useState(false)

  const [checkFileKey, setCheckFileKey] = useState('')
  const [fileExistsResult, setFileExistsResult] = useState<FileExistsResult>({ checked: false, exists: false })
  const [checking, setChecking] = useState(false)

  const [cacheStats, setCacheStats] = useState<CacheStats>(awsStorageService.getCacheStats())

  const hasSignedUrl = useMemo(() => Boolean(signedUrlResult.url), [signedUrlResult.url])

  const handleConfigChange = (field: keyof AWSStorageConfig, value: string) => {
    setAwsConfig((prev) => ({ ...prev, [field]: value }))
  }

  const handleInitialize = async () => {
    setInitializing(true)
    setAwsStatus({ initialized: false, error: null })

    try {
      const success = awsStorageService.initialize(awsConfig)
      if (success) {
        setAwsStatus({ initialized: true, error: null })
        setCacheStats(awsStorageService.getCacheStats())
        showAlert('AWS S3 initialized successfully!', 'success')
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to initialize AWS S3. Please check your credentials.'
      setAwsStatus({ initialized: false, error: message })
      showAlert(message, 'error')
    } finally {
      setInitializing(false)
    }
  }

  const handleGenerateSignedUrl = async (targetKey?: string) => {
    if (!awsStatus.initialized) {
      showAlert('Initialize AWS S3 before generating signed URLs.', 'warning')
      return
    }

    const key = (targetKey ?? fileKey).trim()
    if (!key) {
      showAlert('File key is required to generate a signed URL.', 'warning')
      return
    }

    setGeneratingUrl(true)
    setSignedUrlResult({ url: null, error: null })

    try {
      const url = await awsStorageService.generateSignedUrl(key)
      setFileKey(key)
      setSignedUrlResult({ url, error: null })
      setCacheStats(awsStorageService.getCacheStats())
    } catch (error: any) {
      const message = error?.message || 'Failed to generate signed URL.'
      setSignedUrlResult({ url: null, error: message })
      showAlert(message, 'error')
    } finally {
      setGeneratingUrl(false)
    }
  }

  const handleListFiles = async () => {
    if (!awsStatus.initialized) {
      showAlert('Initialize AWS S3 before listing files.', 'warning')
      return
    }

    setListing(true)

    try {
      const files = await awsStorageService.listFiles(listPrefix)
      setFileList(files)
    } catch (error: any) {
      const message = error?.message || 'Failed to list files.'
      showAlert(message, 'error')
    } finally {
      setListing(false)
    }
  }

  const handleCheckFileExists = async () => {
    if (!awsStatus.initialized) {
      showAlert('Initialize AWS S3 before checking files.', 'warning')
      return
    }

    const key = checkFileKey.trim()
    if (!key) {
      showAlert('File key is required.', 'warning')
      return
    }

    setChecking(true)
    setFileExistsResult({ checked: false, exists: false })

    try {
      const exists = await awsStorageService.fileExists(key)
      setFileExistsResult({ checked: true, exists })
    } catch (error: any) {
      const message = error?.message || 'Failed to check file.'
      showAlert(message, 'error')
    } finally {
      setChecking(false)
    }
  }

  const handleClearCache = () => {
    awsStorageService.clearCache()
    setCacheStats(awsStorageService.getCacheStats())
    showAlert('Cache cleared successfully!', 'success')
  }

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return 'Unknown'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const size = bytes / Math.pow(k, i)
    return `${size.toFixed(2)} ${sizes[i]}`
  }

  const formatDate = (date?: Date) => {
    if (!date) return 'Unknown'
    return new Date(date).toLocaleString()
  }

  const isImageFile = (key: string) => {
    const lowerKey = key.toLowerCase()
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some((ext) => lowerKey.endsWith(ext))
  }

  const content = (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">AWS S3 Storage Test</h1>
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>AWS Configuration</CardTitle>
            <CardDescription>Enter your AWS credentials and bucket details to begin.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="accessKey">Access Key ID</Label>
                <Input
                  id="accessKey"
                  type="password"
                  placeholder="Enter AWS Access Key ID"
                  value={awsConfig.accessKeyId}
                  onChange={(event) => handleConfigChange('accessKeyId', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="secretKey">Secret Access Key</Label>
                <Input
                  id="secretKey"
                  type="password"
                  placeholder="Enter AWS Secret Access Key"
                  value={awsConfig.secretAccessKey}
                  onChange={(event) => handleConfigChange('secretAccessKey', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="region">Region</Label>
                <select
                  id="region"
                  value={awsConfig.region}
                  onChange={(event) => handleConfigChange('region', event.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                >
                  {REGION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="bucket">Bucket Name</Label>
                <Input
                  id="bucket"
                  placeholder="Enter S3 bucket name"
                  value={awsConfig.bucketName}
                  onChange={(event) => handleConfigChange('bucketName', event.target.value)}
                />
              </div>
            </div>
            <div className="mt-6">
              <Button onClick={handleInitialize} disabled={initializing}>
                {initializing ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" />
                    Initializing...
                  </span>
                ) : (
                  'Initialize AWS S3'
                )}
              </Button>
            </div>

            {awsStatus.initialized && (
              <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-4 text-green-800">
                AWS S3 initialized successfully!
              </div>
            )}

            {awsStatus.error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
                {awsStatus.error}
              </div>
            )}
          </CardContent>
        </Card>

        {awsStatus.initialized && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Generate Signed URL</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="signedUrlKey">File Key</Label>
                  <Input
                    id="signedUrlKey"
                    placeholder="e.g., images/vineyard/sample.jpg"
                    value={fileKey}
                    onChange={(event) => setFileKey(event.target.value)}
                  />
                </div>
                <Button onClick={() => handleGenerateSignedUrl()} disabled={generatingUrl}>
                  {generatingUrl ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" />
                      Generating...
                    </span>
                  ) : (
                    'Generate Signed URL'
                  )}
                </Button>

                {hasSignedUrl && (
                  <div className="space-y-3">
                    <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                      <p className="font-medium">Signed URL Generated:</p>
                      <a href={signedUrlResult.url ?? '#'} target="_blank" rel="noopener noreferrer" className="break-all text-primary-700 underline">
                        {signedUrlResult.url}
                      </a>
                    </div>
                    {fileKey && isImageFile(fileKey) && signedUrlResult.url && (
                      <img src={signedUrlResult.url} alt="Preview" className="max-h-64 rounded-md border object-contain" />
                    )}
                  </div>
                )}

                {signedUrlResult.error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
                    {signedUrlResult.error}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>List Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="prefix">Prefix (optional)</Label>
                  <Input
                    id="prefix"
                    placeholder="e.g., images/vineyard/"
                    value={listPrefix}
                    onChange={(event) => setListPrefix(event.target.value)}
                  />
                </div>
                <Button onClick={handleListFiles} disabled={listing}>
                  {listing ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" />
                      Listing...
                    </span>
                  ) : (
                    'List Files'
                  )}
                </Button>

                {fileList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Files found ({fileList.length}):</p>
                    <div className="space-y-2">
                      {fileList.map((file) => (
                        <div
                          key={file.key}
                          className="flex flex-col rounded-md border border-gray-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900 break-all">{file.key}</p>
                            <p className="text-xs text-gray-500">
                              Size: {formatFileSize(file.size)} • Modified: {formatDate(file.lastModified)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 w-full md:mt-0 md:w-auto"
                            onClick={() => handleGenerateSignedUrl(file.key)}
                          >
                            Get URL
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Check File Existence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="checkKey">File Key</Label>
                  <Input
                    id="checkKey"
                    placeholder="e.g., images/vineyard/sample.jpg"
                    value={checkFileKey}
                    onChange={(event) => setCheckFileKey(event.target.value)}
                  />
                </div>
                <Button onClick={handleCheckFileExists} disabled={checking}>
                  {checking ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" />
                      Checking...
                    </span>
                  ) : (
                    'Check File'
                  )}
                </Button>

                {fileExistsResult.checked && (
                  <div
                    className={`rounded-md border p-4 text-sm ${
                      fileExistsResult.exists
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-yellow-200 bg-yellow-50 text-yellow-800'
                    }`}
                  >
                    File {fileExistsResult.exists ? 'exists' : 'does not exist'} in S3 bucket
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Statistics</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1 text-sm text-gray-700">
                  <p>
                    <span className="font-semibold">Cache Size:</span> {cacheStats.size} / {cacheStats.maxSize}
                  </p>
                  <p>
                    <span className="font-semibold">Cache Expiry:</span>{' '}
                    {Math.round(cacheStats.expiryTime / 60000)} minutes
                  </p>
                </div>
                <Button variant="outline" onClick={handleClearCache}>
                  Clear Cache
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )

  return <ProtectedRoute>{content}</ProtectedRoute>
}



