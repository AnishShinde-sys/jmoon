'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { UIProvider } from '@/context/UIContext'
import { MapProvider } from '@/context/MapContext'
import Alert from '@/components/ui/Alert'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <UIProvider>
        <MapProvider>
          <Alert />
          {children}
        </MapProvider>
      </UIProvider>
    </AuthProvider>
  )
}



