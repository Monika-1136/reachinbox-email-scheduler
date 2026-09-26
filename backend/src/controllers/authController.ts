import { Request, Response } from 'express';
import { z } from 'zod';
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
    const { name, email, password } = req.body;
    const { user, token } = await signupUser({ name, email, password });

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, token },
    });
  }

  public static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const { user, token } = await loginUser({ email, password });

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Logged in successfully',
      data: { user, token },
    });
  }

  public static async getMe(req: Request, res: Response): Promise<void> {
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
  }

  public static async googleAuth(req: Request, res: Response): Promise<void> {
    const hasValidGoogleCreds = Boolean(
      config.google.clientId &&
      config.google.clientSecret &&
      !config.google.clientId.includes('your_google_client_id') &&
      !config.google.clientId.includes('placeholder') &&
      !config.google.clientSecret.includes('your_google_client_secret') &&
      !config.google.clientSecret.includes('placeholder')
    );

    if (!hasValidGoogleCreds) {
      const redirectUrl = `${config.frontendUrl}/login?error=Google%20OAuth%20credentials%20are%20not%20configured%20in%20backend/.env.%20Please%20set%20GOOGLE_CLIENT_ID%20and%20GOOGLE_CLIENT_SECRET%20or%20click%201-Click%20Demo%20Login.`;
      res.redirect(redirectUrl);
      return;
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: config.google.callbackUrl,
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
  }

  public static async googleCallback(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string;

    if (!code) {
      res.redirect(`${config.frontendUrl}/login?error=Authorization%20code%20missing`);
      return;
    }

    try {
      // Exchange code for tokens with Google
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          redirect_uri: config.google.callbackUrl,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || 'Failed to exchange token with Google');
      }

      // Fetch user profile
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const googleProfile = await userResponse.json();

      const { token } = await findOrCreateGoogleUser({
        googleId: googleProfile.id,
        email: googleProfile.email,
        name: googleProfile.name || googleProfile.email.split('@')[0],
        avatarUrl: googleProfile.picture,
      });

      // Set cookie and redirect to frontend with token
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });

      res.redirect(`${config.frontendUrl}/dashboard?token=${token}`);
    } catch (error) {
      console.error('[Google OAuth Callback Error]', error);
      res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent((error as Error).message)}`);
    }
  }

  public static async devLogin(req: Request, res: Response): Promise<void> {
    const { email, name } = req.body || {};
    const { user, token } = await createOrGetDevUser(
      email || 'demo@reachinbox.local',
      name || 'Demo User'
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Demo login successful',
      data: { user, token },
    });
  }

  public static async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}
