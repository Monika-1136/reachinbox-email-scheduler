import { Request, Response } from 'express';
import { findOrCreateGoogleUser, createOrGetDevUser } from '../services/authService';
import { config } from '../config/env';

export class AuthController {
  public static async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }
    res.json({
      success: true,
      data: req.user,
    });
  }

  public static async googleAuth(req: Request, res: Response): Promise<void> {
    if (!config.google.clientId || !config.google.clientSecret) {
      // In development when Google Cloud credentials are not configured yet,
      // redirect with helpful info or provide dev user
      const redirectUrl = `${config.frontendUrl}/login?error=Google%20OAuth%20credentials%20not%20configured%20in%20backend%20.env`;
      res.redirect(redirectUrl);
      return;
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: config.google.callbackUrl,
      client_id: config.google.clientId,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
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
      email || 'demo@reachinbox.ai',
      name || 'ReachInbox Demo User'
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
