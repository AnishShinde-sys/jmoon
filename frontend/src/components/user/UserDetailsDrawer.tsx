'use client'

import { useMemo } from 'react'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import { useUserProfile } from '@/context/UserProfileContext'

export default function UserDetailsDrawer() {
  const { drawers, closeDrawer, openDrawer } = useUI()
  const { profile } = useUserProfile()

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

          <div>
            <button
              onClick={handleShowSettings}
              className="w-full flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              User Settings
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

