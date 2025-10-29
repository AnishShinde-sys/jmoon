import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function ScriptPage() {
  const [scriptInput, setScriptInput] = useState('')
  const [scriptOutput, setScriptOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const { showAlert } = useUI()
  const navigate = useNavigate()

  const handleRunScript = async () => {
    if (!scriptInput.trim()) {
      showAlert('Please enter a script or command', 'warning')
      return
    }

    try {
      setLoading(true)
      setScriptOutput('Running script...')

      // This would be a custom endpoint for running admin scripts
      const response = await apiClient.post('/api/admin/script', {
        script: scriptInput,
      })

      setScriptOutput(JSON.stringify(response.data, null, 2))
      showAlert('Script executed successfully', 'success')
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to execute script'
      setScriptOutput(`Error: ${errorMessage}`)
      showAlert(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Script Console</h1>
            <Button onClick={() => navigate('/dashboard')} variant="secondary">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Script Input</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={scriptInput}
              onChange={(e) => setScriptInput(e.target.value)}
              className="font-mono"
              rows={10}
              placeholder="Enter your script or command here..."
            />
            <div className="mt-4">
              <Button
                onClick={handleRunScript}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center">
                    <span className="spinner mr-2"></span>
                    Running...
                  </span>
                ) : (
                  'Run Script'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Output</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto font-mono text-sm min-h-[200px]">
              {scriptOutput || '// Output will appear here'}
            </pre>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
