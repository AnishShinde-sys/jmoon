import { Firestore } from '@google-cloud/firestore'

const firestore = new Firestore()
const COLLECTION = 'notifications'

export interface NotificationMessage {
  id?: string
  recipient: string
  message: string
  url?: string
  type?: 'info' | 'warning' | 'success'
  metadata?: Record<string, any>
  createdOn?: FirebaseFirestore.Timestamp | Date | string
  read?: boolean
}

export async function addNotification(notification: NotificationMessage) {
  const doc = {
    ...notification,
    read: notification.read ?? false,
    createdOn:
      notification.createdOn instanceof Date
        ? notification.createdOn
        : notification.createdOn && typeof (notification.createdOn as any).toDate === 'function'
        ? (notification.createdOn as any).toDate()
        : new Date(),
  }

  const ref = await firestore.collection(COLLECTION).add(doc)
  return { id: ref.id }
}

export async function notifyUsers(
  recipients: Array<string | undefined | null>,
  payload: Omit<NotificationMessage, 'recipient'>
) {
  const uniqueRecipients = Array.from(new Set(recipients.filter((id): id is string => Boolean(id))))
  if (uniqueRecipients.length === 0) {
    return
  }

  await Promise.all(
    uniqueRecipients.map((recipient) =>
      addNotification({
        ...payload,
        recipient,
      }).catch((error) => {
        console.error('Failed to add notification for recipient', recipient, error)
      })
    )
  )
}

export async function markNotificationRead(notificationId: string) {
  await firestore.collection(COLLECTION).doc(notificationId).update({ read: true })
}

export async function getNotificationsForUser(userId: string) {
  const snapshot = await firestore
    .collection(COLLECTION)
    .where('recipient', '==', userId)
    .orderBy('createdOn', 'desc')
    .limit(100)
    .get()

  return snapshot.docs.map((doc) => {
    const data = doc.data() as NotificationMessage
    let createdOn: string | undefined
    const rawCreatedOn = data.createdOn

    if (rawCreatedOn instanceof Date) {
      createdOn = rawCreatedOn.toISOString()
    } else if (rawCreatedOn && typeof (rawCreatedOn as any).toDate === 'function') {
      createdOn = (rawCreatedOn as any).toDate().toISOString()
    } else if (typeof rawCreatedOn === 'string') {
      createdOn = rawCreatedOn
    }

    return {
      id: doc.id,
      ...data,
      createdOn,
    }
  })
}
