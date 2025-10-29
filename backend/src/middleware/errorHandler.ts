import { Request, Response, NextFunction } from 'express'

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err)

  // Default error
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal Server Error'

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400
    message = err.message
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Invalid or expired token'
  }

  // GCS errors
  if (err.code === 'ENOENT' || err.code === 404) {
    statusCode = 404
    message = 'Resource not found'
  }

  res.status(statusCode).json({
    error: err.name || 'Error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
