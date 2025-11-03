'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { UIProvider } from '@/context/UIContext'
import { MapProvider } from '@/context/MapContext'
import Alert from '@/components/ui/Alert'
import { UserProfileProvider } from '@/context/UserProfileContext'
import UserSettingsDrawer from '@/components/user/UserSettingsDrawer'
import NotificationsDrawer from '@/components/user/NotificationsDrawer'
import FeedbackModal from '@/components/user/FeedbackModal'
import TermsModal from '@/components/user/TermsModal'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <UIProvider>
        <UserProfileProvider>
          <MapProvider>
            <Alert />
            <UserSettingsDrawer />
            <NotificationsDrawer />
            <FeedbackModal />
            <TermsModal />
            {children}
          </MapProvider>
        </UserProfileProvider>
      </UIProvider>
    </AuthProvider>
  )
}





