import { Router } from 'express';
import { AuthController, signupSchema, loginSchema } from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validateMiddleware';

export const authRouter = Router();

authRouter.post('/signup', validateBody(signupSchema), AuthController.signup);
authRouter.post('/login', validateBody(loginSchema), AuthController.login);
authRouter.get('/me', requireAuth, AuthController.getMe);
authRouter.get('/google', AuthController.googleAuth);
authRouter.get('/google/callback', AuthController.googleCallback);
authRouter.post('/demo', AuthController.devLogin);
authRouter.post('/dev-login', AuthController.devLogin);
authRouter.post('/logout', AuthController.logout);
