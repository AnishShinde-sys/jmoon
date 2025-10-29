import { Request, Response, NextFunction } from 'express'
import { auth as firebaseAuth } from '../config/firebase'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email?: string
    role?: string
  }
}

/**
 * Middleware to verify Firebase ID token
 */
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    try {
      // Verify Firebase ID token
      const decodedToken = await firebaseAuth.verifyIdToken(token)

      // Attach user info to request
      req.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        role: 'user', // You can add custom claims for roles if needed
      }

      next()
    } catch (error: any) {
      console.error('Token verification failed:', error)
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      })
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(500).json({
      error: 'InternalError',
      message: 'Authentication failed',
    })
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export async function optionalAuthenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)

      try {
        const decodedToken = await firebaseAuth.verifyIdToken(token)

        req.user = {
          id: decodedToken.uid,
          email: decodedToken.email,
          role: 'user',
        }
      } catch (error) {
        // Continue without auth if token verification fails
        console.warn('Optional auth: Token verification failed')
      }
    }

    next()
  } catch (error) {
    // Continue without auth if there's an error
    next()
  }
}
