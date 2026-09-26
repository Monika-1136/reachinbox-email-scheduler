import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

export const authRouter = Router();

authRouter.get('/me', requireAuth, AuthController.getMe);
authRouter.get('/google', AuthController.googleAuth);
authRouter.get('/google/callback', AuthController.googleCallback);
authRouter.post('/dev-login', AuthController.devLogin);
authRouter.post('/logout', AuthController.logout);
