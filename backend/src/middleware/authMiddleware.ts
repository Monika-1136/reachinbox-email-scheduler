import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { AuthUser } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  // 1. Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies?.token) {
    // 2. HTTP-only cookie
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: No authentication token provided',
    });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired token',
    });
    return;
  }

  req.user = user;
  next();
}
