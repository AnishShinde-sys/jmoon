'use client'

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'

import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { fetchCurrentUserProfile, updateCurrentUserProfile } from '@/services/userService'
import type { UserProfile } from '@/types/user'
import { TERMS_VERSION } from '@/constants/terms'

interface UserProfileContextValue {
  profile: UserProfile | null
  loading: boolean
  refresh: () => Promise<void>
  updateProfile: (input: Partial<UserProfile>) => Promise<UserProfile>
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined)

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { openModal } = useUI()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const result = await fetchCurrentUserProfile()
      setProfile(result)
      if (result?.tosId !== TERMS_VERSION) {
        openModal('termsOfService')
      }
    } catch (error) {
      console.error('Failed to load user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const handleUpdate = async (input: Partial<UserProfile>) => {
    const updated = await updateCurrentUserProfile(input)
    setProfile(updated)
    return updated
  }

  const value = useMemo<UserProfileContextValue>(
    () => ({
      profile,
      loading,
      refresh: loadProfile,
      updateProfile: handleUpdate,
    }),
    [profile, loading]
  )

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>
}

export function useUserProfile() {
  const context = useContext(UserProfileContext)
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider')
  }
  return context
}

