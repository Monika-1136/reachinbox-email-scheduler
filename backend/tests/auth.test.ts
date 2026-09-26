import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../src/services/authService';
import { requireAuth } from '../src/middleware/authMiddleware';
import { Request, Response } from 'express';

describe('Auth Service & Middleware', () => {
  const mockUser = {
    id: 'user-auth-123',
    email: 'sarah@reachinbox.test',
    name: 'Sarah Connor',
    avatarUrl: 'https://avatar.test/sarah.jpg',
  };

  it('signs and verifies a valid JWT payload', () => {
    const token = signToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(mockUser.id);
    expect(decoded?.email).toBe(mockUser.email);
    expect(decoded?.name).toBe(mockUser.name);
  });

  it('returns null when verifying an invalid or tampered JWT', () => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.token';
    const decoded = verifyToken(invalidToken);
    expect(decoded).toBeNull();
  });

  it('middleware should reject requests with no token and return 401', () => {
    const req = { headers: {}, cookies: {} } as Request;
    let statusCode: number | null = null;
    let jsonResponse: any = null;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonResponse = data;
          },
        };
      },
    } as unknown as Response;

    const next = () => {};

    requireAuth(req, res, next);

    expect(statusCode).toBe(401);
    expect(jsonResponse.success).toBe(false);
  });

  it('middleware should authenticate requests with valid Bearer token and attach req.user', () => {
    const token = signToken(mockUser);
    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: {},
    } as unknown as Request;

    let nextCalled = false;
    const res = {} as Response;
    const next = () => {
      nextCalled = true;
    };

    requireAuth(req, res, next);

    expect(nextCalled).toBe(true);
    expect(req.user?.id).toBe(mockUser.id);
  });

  it('signs up a user with bcrypt hashed password and allows subsequent login', async () => {
    const { signupUser, loginUser } = await import('../src/services/authService');
    const testEmail = `test-user-${Date.now()}@reachinbox.test`;
    const testPass = 'SecurePass123!';

    const signupResult = await signupUser({
      name: 'Test Auth User',
      email: testEmail,
      password: testPass,
    });

    expect(signupResult.user.email).toBe(testEmail);
    expect(signupResult.token).toBeDefined();

    // Login with correct credentials
    const loginResult = await loginUser({
      email: testEmail,
      password: testPass,
    });
    expect(loginResult.user.id).toBe(signupResult.user.id);
    expect(loginResult.token).toBeDefined();

    // Login with wrong password should fail
    await expect(
      loginUser({
        email: testEmail,
        password: 'WrongPassword!',
      })
    ).rejects.toThrow('Invalid email or password');
  });
});
