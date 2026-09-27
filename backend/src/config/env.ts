import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root or workspace root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const vercelBaseUrl = vercelDomain ? (vercelDomain.startsWith('http') ? vercelDomain : `https://${vercelDomain}`) : '';

const defaultFrontend = process.env.FRONTEND_URL || vercelBaseUrl || 'http://localhost:5173';
const defaultBackend = process.env.BACKEND_URL || vercelBaseUrl || 'http://localhost:5000';

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  frontendUrl: defaultFrontend,
  backendUrl: defaultBackend,

  jwtSecret: process.env.JWT_SECRET || 'reachinbox_default_super_secret_jwt_key_2026',
  sessionSecret: process.env.SESSION_SECRET || 'reachinbox_default_session_secret_key_2026',

  databaseUrl: process.env.DATABASE_URL || 'mysql://root:root@localhost:3306/reachinbox',

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      `${defaultBackend}/api/auth/google/callback`,
  },

  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri:
      process.env.SLACK_REDIRECT_URI ||
      `${defaultBackend}/api/slack/callback`,
  },

  smtp: {
    provider: (process.env.SMTP_PROVIDER || 'ethereal').toLowerCase(),
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'ReachInbox Scheduler <outreach@reachinbox.test>',
  },

  elasticsearchUrl: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',

  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    minDelayMs: parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000', 10),
    maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
  },
};
