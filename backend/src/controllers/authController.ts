import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { findOrCreateGoogleUser, createOrGetDevUser, signupUser, loginUser } from '../services/authService';
import { config } from '../config/env';

export const signupSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export class AuthController {
  public static async signup(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password } = req.body;
      const { user, token } = await signupUser({ name, email, password });

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isHttps || config.isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/',
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: { user, token },
      });
    } catch (err: any) {
      const message = err.message || 'Signup failed';
      const statusCode = message.includes('already exists') ? 409 : 400;
      res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }

  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const { user, token } = await loginUser({ email, password });

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isHttps || config.isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/',
      });

      res.json({
        success: true,
        message: 'Logged in successfully',
        data: { user, token },
      });
    } catch (err: any) {
      const message = err.message || 'Login failed';
      const statusCode = message.includes('Invalid email or password') ? 401 : 400;
      res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }

  public static async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
        },
      });

      if (!dbUser) {
        res.status(401).json({ success: false, message: 'User record not found in database' });
        return;
      }

      res.json({
        success: true,
        data: dbUser,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch user profile',
      });
    }
  }

  public static async googleAuth(req: Request, res: Response): Promise<void> {
    try {
      const protocol = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      const currentHost = req.headers.host || 'localhost:5000';
      const frontendOrigin =
        config.frontendUrl && !config.frontendUrl.includes('localhost')
          ? config.frontendUrl
          : `${protocol}://${currentHost}`;

      const hasValidGoogleCreds = Boolean(
        config.google.clientId &&
        config.google.clientSecret &&
        !config.google.clientId.includes('your_google_client_id') &&
        !config.google.clientId.includes('placeholder') &&
        !config.google.clientSecret.includes('your_google_client_secret') &&
        !config.google.clientSecret.includes('placeholder')
      );

      if (!hasValidGoogleCreds) {
        const redirectUrl = `${frontendOrigin}/login?error=${encodeURIComponent(
          'Google OAuth credentials are not configured in environment. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or use 1-Click Demo Login.'
        )}`;
        res.redirect(redirectUrl);
        return;
      }

      const dynamicCallback =
        process.env.GOOGLE_CALLBACK_URL ||
        `${protocol}://${currentHost}/api/auth/google/callback`;

      const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
      const options = {
        redirect_uri: dynamicCallback,
        client_id: config.google.clientId,
        access_type: 'offline',
        response_type: 'code',
        prompt: 'select_account',
        scope: [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
      };

      const qs = new URLSearchParams(options);
      res.redirect(`${rootUrl}?${qs.toString()}`);
    } catch (err: any) {
      console.error('[Google OAuth Init Error]', err);
      const protocol = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      const currentHost = req.headers.host || 'localhost:5000';
      const frontendOrigin =
        config.frontendUrl && !config.frontendUrl.includes('localhost')
          ? config.frontendUrl
          : `${protocol}://${currentHost}`;
      res.redirect(`${frontendOrigin}/login?error=${encodeURIComponent(err.message || 'Failed to initiate Google authentication')}`);
    }
  }

  public static async googleCallback(req: Request, res: Response): Promise<void> {
    const protocol = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
    const currentHost = req.headers.host || 'localhost:5000';
    const frontendOrigin =
      config.frontendUrl && !config.frontendUrl.includes('localhost')
        ? config.frontendUrl
        : `${protocol}://${currentHost}`;

    const code = req.query.code as string;

    if (!code) {
      res.redirect(`${frontendOrigin}/login?error=${encodeURIComponent('Authorization code missing from Google callback')}`);
      return;
    }

    try {
      const dynamicCallback =
        process.env.GOOGLE_CALLBACK_URL ||
        `${protocol}://${currentHost}/api/auth/google/callback`;

      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          redirect_uri: dynamicCallback,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange token with Google');
      }

      // Fetch user profile
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const googleProfile = await userResponse.json();

      const { token } = await findOrCreateGoogleUser({
        googleId: googleProfile.id,
        email: googleProfile.email,
        name: googleProfile.name || googleProfile.email?.split('@')[0] || 'Google User',
        avatarUrl: googleProfile.picture,
      });

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isHttps || config.isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/',
      });

      res.redirect(`${frontendOrigin}/dashboard?token=${token}`);
    } catch (error) {
      console.error('[Google OAuth Callback Error]', error);
      res.redirect(`${frontendOrigin}/login?error=${encodeURIComponent((error as Error).message)}`);
    }
  }

  public static async devLogin(req: Request, res: Response): Promise<void> {
    try {
      const { email, name } = req.body || {};
      const { user, token } = await createOrGetDevUser(
        email || 'demo@reachinbox.local',
        name || 'Demo User'
      );

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isHttps || config.isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/',
      });

      res.json({
        success: true,
        message: 'Demo login successful',
        data: { user, token },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Demo login failed',
      });
    }
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie('token', {
      httpOnly: true,
      secure: isHttps || config.isProd,
      sameSite: 'lax',
      path: '/',
    });
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}
