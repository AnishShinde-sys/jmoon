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

// Import middleware
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
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
