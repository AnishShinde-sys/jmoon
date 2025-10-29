import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK
// For local development, use Application Default Credentials or service account
// For production, use environment variable GOOGLE_APPLICATION_CREDENTIALS

let firebaseApp: admin.app.App

try {
  // Try to initialize with default credentials first
  firebaseApp = admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID,
  })
  console.log('✅ Firebase Admin initialized successfully')
} catch (error: any) {
  // If already initialized, get the existing app
  if (error.code === 'app/duplicate-app') {
    firebaseApp = admin.app()
  } else {
    console.error('❌ Error initializing Firebase Admin:', error)
    throw error
  }
}

export const auth = admin.auth(firebaseApp)
export default firebaseApp
