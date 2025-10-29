import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import SignUpForm from '@/components/auth/SignUpForm'
import apiClient from '@/lib/apiClient'

export default function SignUpPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''
  const inviter = searchParams.get('inviter') || ''
  const farm = searchParams.get('farm') || ''
  const role = searchParams.get('role') || 'collaborator'

  useEffect(() => {
    // Redirect to dashboard if already logged in
    if (user) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  const handleSuccess = async () => {
    try {
      // Create user profile on backend (this also processes pending invitations)
      await apiClient.post('/api/users/me', {
        email: user?.email || email,
        name: user?.displayName || '',
      })
    } catch (error: any) {
      // If profile already exists (409), that's ok
      if (error.response?.status !== 409) {
        console.error('Error creating user profile:', error)
      }
    }
    
    // After successful signup, redirect to dashboard
    navigate('/dashboard')
  }

  const isInvited = inviter && farm && role

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {isInvited && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{inviter}</span> has invited you to collaborate on{' '}
              <span className="font-semibold">{farm}</span> as{' '}
              <span className="font-semibold text-primary-600">{role}</span>.
            </p>
          </div>
        )}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-900 mb-2">Join Budbase</h1>
          <p className="text-gray-600">Create your account to get started</p>
        </div>
        <SignUpForm prefilledEmail={email} onSuccess={handleSuccess} />
      </div>
    </div>
  )
}

