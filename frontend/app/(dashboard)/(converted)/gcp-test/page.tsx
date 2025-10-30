'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Spinner from '@/components/ui/Spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUI } from '@/context/UIContext'
import { gcpStorageClient, GcpConfig } from '@/services/gcpStorageClient'

type InitState = 'idle' | 'loading' | 'success' | 'error'

export default function GcpStorageTestPage() {
  const router = useRouter()
  const { showAlert } = useUI()

  const [config, setConfig] = useState<GcpConfig | null>(null)
  const [initState, setInitState] = useState<InitState>('idle')
  const [initError, setInitError] = useState<string | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)

  const [filePath, setFilePath] = useState('path/to/your/file.jpg')
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [generatingUrl, setGeneratingUrl] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingConfig(true)
        const initialConfig = await gcpStorageClient.getConfig()
        setConfig(initialConfig)
        await initialize()
      } catch (error: any) {
        setInitState('error')
        setInitError(error?.message ?? 'Failed to load configuration')
      } finally {
        setLoadingConfig(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initialize = async () => {
    try {
      setInitState('loading')
      setInitError(null)
      const response = await gcpStorageClient.initialize()
      setConfig(response.config)
      setInitState(response.success ? 'success' : 'error')
      if (!response.success) {
        setInitError(response.message ?? 'Initialization failed')
      }
    } catch (error: any) {
      setInitState('error')
      setInitError(error?.message ?? 'Failed to initialize GCP Storage')
    }
  }

  const handleGenerateUrl = async () => {
    if (initState !== 'success') {
      showAlert('Initialize GCP Storage before generating URLs.', 'warning')
      return
    }

    if (!filePath.trim()) {
      showAlert('Please enter a file path.', 'warning')
      return
    }

    try {
      setGeneratingUrl(true)
      setSignedUrl(null)
      const url = await gcpStorageClient.generateSignedUrl(filePath.trim())
      setSignedUrl(url)
      showAlert('Signed URL generated successfully!', 'success')
    } catch (error: any) {
      const message = error?.message ?? 'Failed to generate signed URL.'
      showAlert(message, 'error')
    } finally {
      setGeneratingUrl(false)
    }
  }

  const handleCopyUrl = async () => {
    if (!signedUrl) return

    try {
      await navigator.clipboard.writeText(signedUrl)
      showAlert('Signed URL copied to clipboard!', 'success')
    } catch (error: any) {
      const message = error?.message ?? 'Failed to copy URL to clipboard'
      showAlert(message, 'error')
    }
  }

  const renderInitializationStatus = () => {
    if (loadingConfig) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Spinner size="sm" /> Loading configuration...
        </div>
      )
    }

    if (initState === 'success') {
      return <span className="text-sm font-semibold text-green-700">Initialization successful</span>
    }

    if (initState === 'error') {
      return <span className="text-sm font-semibold text-red-600">{initError}</span>
    }

    return <span className="text-sm text-gray-600">Awaiting initialization</span>
  }

  const content = (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">GCP Storage Test</h1>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Initialization</CardTitle>
            <CardDescription>Verify connectivity to Google Cloud Storage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>{renderInitializationStatus()}</div>
            <Button onClick={initialize} disabled={initState === 'loading'}>
              {initState === 'loading' ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" /> Initializing...
                </span>
              ) : (
                'Initialize GCP Storage'
              )}
            </Button>

            {config && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-semibold">Current Configuration</p>
                <ul className="mt-2 space-y-1">
                  <li>
                    <strong>Project ID:</strong> {config.projectId ?? 'Not set'}
                  </li>
                  <li>
                    <strong>Bucket Name:</strong> {config.bucketName ?? 'Not set'}
                  </li>
                  <li>
                    <strong>URL Expiry:</strong> {config.signedUrlExpiryMinutes} minutes
                  </li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generate Signed URL</CardTitle>
            <CardDescription>Create a temporary read URL for a GCS object.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="filePath">File Path</Label>
              <Input
                id="filePath"
                placeholder="path/to/your/file.jpg"
                value={filePath}
                onChange={(event) => setFilePath(event.target.value)}
              />
            </div>
            <Button onClick={handleGenerateUrl} disabled={generatingUrl}>
              {generatingUrl ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" /> Generating...
                </span>
              ) : (
                'Generate Signed URL'
              )}
            </Button>

            {signedUrl && (
              <div className="space-y-3 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <p className="font-semibold">Signed URL:</p>
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="break-all text-primary-700 underline">
                  {signedUrl}
                </a>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                    Copy URL
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => window.open(signedUrl, '_blank')}>
                    Open in New Tab
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )

  return <ProtectedRoute>{content}</ProtectedRoute>
}



