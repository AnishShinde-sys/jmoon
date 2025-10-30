'use client'

import { useEffect, useState } from 'react'
import { ClockIcon, CheckIcon, XMarkIcon, LinkIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

import Drawer from '@/components/ui/Drawer'
import { useUI } from '@/context/UIContext'
import {
  acceptInvitation,
  declineInvitation,
  fetchPendingInvitations,
  fetchNotifications,
  markNotificationRead,
} from '@/services/userService'
import type { Invitation, NotificationItem } from '@/services/userService'

export default function NotificationsDrawer() {
  const { drawers, closeDrawer, showAlert } = useUI()
  const [loading, setLoading] = useState(false)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const isOpen = Boolean(drawers.notifications)

  const loadData = async () => {
    try {
      setLoading(true)
      const [invitationData, notificationData] = await Promise.all([
        fetchPendingInvitations().catch((error) => {
          console.error('Failed to load invitations:', error)
          return []
        }),
        fetchNotifications().catch((error) => {
          console.error('Failed to load notifications:', error)
          return []
        }),
      ])
      setInvitations(invitationData)
      setNotifications(notificationData)
    } catch (error: any) {
      showAlert(error?.message || 'Failed to load notifications', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleAcceptInvitation = async (farmId: string) => {
    try {
      await acceptInvitation(farmId)
      showAlert('Invitation accepted', 'success')
      setInvitations((prev) => prev.filter((inv) => inv.farmId !== farmId))
    } catch (error: any) {
      showAlert(error?.message || 'Failed to accept invitation', 'error')
    }
  }

  const handleDeclineInvitation = async (farmId: string) => {
    try {
      await declineInvitation(farmId)
      showAlert('Invitation declined', 'info')
      setInvitations((prev) => prev.filter((inv) => inv.farmId !== farmId))
    } catch (error: any) {
      showAlert(error?.message || 'Failed to decline invitation', 'error')
    }
  }

  const handleNotificationClick = async (notification: NotificationItem) => {
    try {
      if (!notification.read && notification.id) {
        await markNotificationRead(notification.id)
        setNotifications((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
        )
      }

      if (notification.url) {
        window.open(notification.url, '_blank', 'noopener')
      }
    } catch (error: any) {
      console.error('Failed to handle notification click:', error)
    }
  }

  const hasContent = invitations.length > 0 || notifications.length > 0

  return (
    <Drawer isOpen={isOpen} onClose={() => closeDrawer('notifications')} title="Notifications" position="right">
      <div className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ClockIcon className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !hasContent ? (
          <p className="text-sm text-gray-500">You have no notifications at this time.</p>
        ) : (
          <>
            {invitations.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Invitations</p>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div key={invitation.farmId} className="rounded-md border border-gray-200 p-4 shadow-sm">
                      <p className="text-sm font-semibold text-gray-900">
                        Invitation to join{' '}
                        <span className="text-primary-600">{invitation.farmName || invitation.farmId}</span>
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Role: {invitation.role} • Invited by {invitation.inviterEmail}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Sent {new Date(invitation.createdAt).toLocaleString()}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleAcceptInvitation(invitation.farmId)}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
                        >
                          <CheckIcon className="h-4 w-4" /> Accept
                        </button>
                        <button
                          onClick={() => handleDeclineInvitation(invitation.farmId)}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <XMarkIcon className="h-4 w-4" /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notifications.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Activity</p>
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full rounded-md border border-gray-200 px-3 py-2 text-left shadow-sm transition hover:bg-gray-50 ${
                        notification.read ? 'bg-white' : 'bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full ${
                          notification.type === 'warning'
                            ? 'bg-yellow-100 text-yellow-600'
                            : notification.type === 'success'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-primary-100 text-primary-600'
                        }`}>
                          {notification.url ? (
                            <LinkIcon className="h-4 w-4" />
                          ) : (
                            <ExclamationCircleIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                            {notification.message}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {notification.createdOn ? new Date(notification.createdOn).toLocaleString() : ''}
                          </p>
                          {notification.url && (
                            <p className="mt-1 text-xs text-primary-600">Click to open link</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}

