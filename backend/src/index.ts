import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Import routes
import farmsRouter from './routes/farms'
import blocksRouter from './routes/blocks'
import datasetsRouter from './routes/datasets'
import usersRouter from './routes/users'
import pluginsRouter from './routes/plugins'
import collectorsRouter from './routes/collectors'
import adminRouter from './routes/admin'
import feedbackRouter from './routes/feedback'
import notificationsRouter from './routes/notifications'

// Import middleware
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 8080

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000']

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
}

// Middleware
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(helmet({
  crossOriginResourcePolicy: false,
}))
app.use(morgan('combined'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/users', usersRouter)
app.use('/api/farms', farmsRouter)
app.use('/api', blocksRouter) // Mount at /api so routes like /farms/:farmId/blocks work
app.use('/api', datasetsRouter) // Mount at /api so routes like /farms/:farmId/datasets work
app.use('/api', pluginsRouter)
app.use('/api', collectorsRouter) // Mount at /api so routes like /farms/:farmId/collectors work
app.use('/api/admin', adminRouter)
app.use('/api/feedback', feedbackRouter)
app.use('/api/notifications', notificationsRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route not found' })
})

// Error handler (must be last)
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🗄️  GCS Bucket: ${process.env.GCS_BUCKET_NAME || 'not configured'}`)
})

export default app
