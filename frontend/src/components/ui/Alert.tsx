'use client'

import { useUI } from '@/context/UIContext'

export default function Alert() {
  const { alerts, dismissAlert } = useUI()

  if (alerts.length === 0) return null

  const getAlertStyles = (level: string) => {
    switch (level) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between p-4 border rounded-lg shadow-lg ${getAlertStyles(
            alert.level
          )}`}
        >
          <p className="text-sm font-medium">{alert.message}</p>
          <button
            onClick={() => dismissAlert(alert.id)}
            className="ml-4 text-current opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
