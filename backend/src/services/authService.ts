import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { config } from './../config/env';
import { AuthUser } from '../types';

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

export async function findOrCreateGoogleUser(profile: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): Promise<{ user: AuthUser; token: string }> {
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ googleId: profile.googleId }, { email: profile.email.toLowerCase() }],
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: profile.googleId,
        email: profile.email.toLowerCase(),
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
    });

    // Create a default sender for the user
    await prisma.sender.create({
      data: {
        userId: user.id,
        email: user.email,
        displayName: user.name,
        hourlyLimit: config.worker.maxEmailsPerHour,
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl || user.avatarUrl,
      },
    });
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };

  const token = signToken(authUser);
  return { user: authUser, token };
}

export async function createOrGetDevUser(email = 'demo@reachinbox.ai', name = 'ReachInbox Demo User'): Promise<{ user: AuthUser; token: string }> {
  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
      },
    });

    await prisma.sender.create({
      data: {
        userId: user.id,
        email: user.email,
        displayName: user.name,
        hourlyLimit: config.worker.maxEmailsPerHour,
      },
    });
  }

  // Ensure user has at least one sender
  const senderCount = await prisma.sender.count({ where: { userId: user.id } });
  if (senderCount === 0) {
    await prisma.sender.create({
      data: {
        userId: user.id,
        email: user.email,
        displayName: user.name,
        hourlyLimit: config.worker.maxEmailsPerHour,
      },
    });
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };

  const token = signToken(authUser);
  return { user: authUser, token };
}
