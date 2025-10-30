import axios from 'axios'
import { auth } from './firebase'

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.VITE_API_BASE_URL

if (!apiBaseUrl) {
  console.warn('NEXT_PUBLIC_API_BASE_URL (or legacy VITE_API_BASE_URL) not set. API calls may fail.')
}

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: apiBaseUrl || '',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add Firebase auth token
apiClient.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser
    if (user) {
      try {
        const token = await user.getIdToken()
        config.headers.Authorization = `Bearer ${token}`
      } catch (error) {
        console.error('Error getting Firebase token:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('401 Unauthorized error from API')
      // Could redirect to login here if needed
      // window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
