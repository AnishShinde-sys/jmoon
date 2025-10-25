import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '@/context/UIContext'
import apiClient from '@/lib/apiClient'

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
            <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Script Input</h2>
          </div>
          <div className="card-body">
            <textarea
              value={scriptInput}
              onChange={(e) => setScriptInput(e.target.value)}
              className="input font-mono text-sm"
              rows={10}
              placeholder="Enter your script or command here..."
            />
            <div className="mt-4">
              <button
                onClick={handleRunScript}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? (
                  <span className="flex items-center">
                    <span className="spinner mr-2"></span>
                    Running...
                  </span>
                ) : (
                  'Run Script'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Output</h2>
          </div>
          <div className="card-body">
            <pre className="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto font-mono text-sm min-h-[200px]">
              {scriptOutput || '// Output will appear here'}
            </pre>
          </div>
        </div>
      </main>
    </div>
  )
}
