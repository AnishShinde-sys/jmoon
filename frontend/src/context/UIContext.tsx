import { createContext, useContext, useState, ReactNode } from 'react'

type AlertLevel = 'info' | 'success' | 'warning' | 'error'

interface Alert {
  message: string
  level: AlertLevel
  id: string
}

interface DrawerState {
  [key: string]: boolean | string | any
}

interface ModalState {
  [key: string]: boolean
}

interface UIContextType {
  // Alerts
  alerts: Alert[]
  showAlert: (message: string, level?: AlertLevel) => void
  dismissAlert: (id: string) => void
  // Drawers
  drawers: DrawerState
  openDrawer: (name: string, data?: any) => void
  closeDrawer: (name: string) => void
  toggleDrawer: (name: string) => void
  // Modals
  modals: ModalState
  openModal: (name: string) => void
  closeModal: (name: string) => void
  toggleModal: (name: string) => void
  // Loading
  loading: boolean
  setLoading: (loading: boolean) => void
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export function UIProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [drawers, setDrawers] = useState<DrawerState>({})
  const [modals, setModals] = useState<ModalState>({})
  const [loading, setLoading] = useState(false)

  const showAlert = (message: string, level: AlertLevel = 'info') => {
    // Generate unique ID with timestamp + random number to avoid collisions
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    setAlerts((prev) => [...prev, { message, level, id }])

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      dismissAlert(id)
    }, 5000)
  }

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id))
  }

  const openDrawer = (name: string, data?: any) => {
    setDrawers((prev) => ({ ...prev, [name]: data !== undefined ? data : true }))
  }

  const closeDrawer = (name: string) => {
    setDrawers((prev) => ({ ...prev, [name]: false }))
  }

  const toggleDrawer = (name: string) => {
    setDrawers((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const openModal = (name: string) => {
    setModals((prev) => ({ ...prev, [name]: true }))
  }

  const closeModal = (name: string) => {
    setModals((prev) => ({ ...prev, [name]: false }))
  }

  const toggleModal = (name: string) => {
    setModals((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const value = {
    alerts,
    showAlert,
    dismissAlert,
    drawers,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    modals,
    openModal,
    closeModal,
    toggleModal,
    loading,
    setLoading,
  }

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const context = useContext(UIContext)
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider')
  }
  return context
}
