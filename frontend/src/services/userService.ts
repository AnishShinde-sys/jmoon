import apiClient from '@/lib/apiClient'
import type { UserProfile } from '@/types/user'

export async function fetchCurrentUserProfile(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>('/api/users/me')
  return response.data
}

export async function updateCurrentUserProfile(update: Partial<UserProfile>): Promise<UserProfile> {
  const response = await apiClient.put<UserProfile>('/api/users/me', update)
  return response.data
}

export interface Invitation {
  farmId: string
  role: string
  email: string
  inviterId: string
  inviterEmail: string
  createdAt: string
  farmName?: string
}

export interface NotificationItem {
  id: string
  recipient: string
  message: string
  url?: string
  type?: 'info' | 'warning' | 'success'
  metadata?: Record<string, any>
  createdOn?: string
  read?: boolean
}

type CreateNotificationInput = {
  recipient: string
  message: string
  url?: string
  type?: 'info' | 'warning' | 'success'
  metadata?: Record<string, any>
}

export async function fetchPendingInvitations(): Promise<Invitation[]> {
  const response = await apiClient.get<Invitation[]>('/api/users/me/invitations')
  return response.data
}

export async function acceptInvitation(farmId: string): Promise<void> {
  await apiClient.post(`/api/users/me/invitations/${farmId}/accept`)
}

export async function declineInvitation(farmId: string): Promise<void> {
  await apiClient.post(`/api/users/me/invitations/${farmId}/decline`)
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const response = await apiClient.get<NotificationItem[]>('/api/notifications')
  return response.data
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiClient.post(`/api/notifications/${notificationId}/read`)
}

export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const response = await apiClient.post<{ id: string }>('/api/notifications', input)
  return response.data.id
}

