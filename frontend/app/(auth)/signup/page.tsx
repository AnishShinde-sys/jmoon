'use client'

import { useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import SignUpForm from '@/components/auth/SignUpForm'
import apiClient from '@/lib/apiClient'

export default function SignUpPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const email = searchParams.get('email') ?? ''
  const inviter = searchParams.get('inviter') ?? ''
  const farm = searchParams.get('farm') ?? ''
  const role = searchParams.get('role') ?? 'collaborator'

  useEffect(() => {
    if (user) {
      router.replace('/dashboard')
    }
  }, [user, router])

  const handleSuccess = useCallback(async () => {
    try {
      await apiClient.post('/api/users/me', {
        email: user?.email ?? email,
        name: user?.displayName ?? '',
      })
    } catch (error: any) {
      if (error?.response?.status !== 409) {
        console.error('Error creating user profile:', error)
      }
    }

    router.push('/dashboard')
  }, [email, router, user])

  const isInvited = Boolean(inviter && farm && role)

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/bg.png')",
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-black/30"></div>
      <div className="relative z-10 w-full max-w-md">
        {isInvited && (
          <div className="mb-6 bg-blue-50/90 backdrop-blur-sm border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{inviter}</span> has invited you to collaborate on{' '}
              <span className="font-semibold">{farm}</span> as{' '}
              <span className="font-semibold text-primary-600">{role}</span>.
            </p>
          </div>
        )}
        <SignUpForm prefilledEmail={email} onSuccess={handleSuccess} />
      </div>
    </div>
  )
}

