'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { ArrowRightOnRectangleIcon, Cog6ToothIcon, Squares2X2Icon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { useUserProfile } from '@/context/UserProfileContext'

export default function UserDetailsDrawer() {
  const router = useRouter()
  const { drawers, closeDrawer, openDrawer } = useUI()
  const { profile } = useUserProfile()
  const { signOut } = useAuth()

  const isOpen = Boolean(drawers.userDetails)

  const displayName = useMemo(() => {
    if (!profile) return ''
    if (profile.name) return profile.name
    const parts = [profile.firstName, profile.lastName].filter(Boolean)
    if (parts.length) return parts.join(' ')
    return ''
  }, [profile])

  const handleClose = () => closeDrawer('userDetails')

  const handleShowSettings = () => {
    closeDrawer('userDetails')
    setTimeout(() => openDrawer('userSettings'), 150)
  }

  const handleShowFarms = () => {
    closeDrawer('userDetails')
    router.push('/dashboard')
  }

  const handleSignOut = async () => {
    await signOut()
    closeDrawer('userDetails')
    router.replace('/login')
  }

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Account" position="right">
      {profile ? (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-500">Signed in as</p>
            <p className="text-lg font-semibold text-gray-900 break-all">{profile.email}</p>
            {displayName && <p className="mt-1 text-sm text-gray-600">{displayName}</p>}
            {profile.company && <p className="mt-1 text-sm text-gray-600">{profile.company}</p>}
            <p className="mt-2 text-xs uppercase tracking-wide text-gray-400">Role: {profile.role}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleShowFarms}
              className="w-full flex items-center gap-2 rounded-md bg-primary text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-primary/90 transition"
            >
              <Squares2X2Icon className="h-4 w-4" />
              My Farms
            </button>

            <button
              onClick={handleShowSettings}
              className="w-full flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              User Settings
            </button>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Sign Out
            </button>
          </div>

          <div className="border-t border-gray-200 pt-4 text-xs text-gray-400">
            <p>User ID: {profile.id}</p>
            {profile.updatedAt && (
              <p>Updated: {new Date(profile.updatedAt).toLocaleString()}</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Loading profile…</p>
      )}
    </Drawer>
  )
}

