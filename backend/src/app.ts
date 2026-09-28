import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { authRouter } from './routes/authRoutes';
import { senderRouter } from './routes/senderRoutes';
import { campaignRouter } from './routes/campaignRoutes';
import { emailRouter } from './routes/emailRoutes';
import { slackRouter } from './routes/slackRoutes';
import { bullBoardRouter, getQueueStatsHandler } from './controllers/adminController';
import { EmailService } from './services/emailService';
import { errorHandler } from './middleware/errorMiddleware';
import { getEsStatus } from './config/elasticsearch';
import { redisClient } from './config/redis';
import { prisma } from './config/db';

export function createApp(): Express {
  const app = express();

  // Security Middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // allow Bull Board UI assets and icons
    })
  );

  // CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedOrigins = [
          config.frontendUrl,
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:5174',
          'http://127.0.0.1:5175',
        ];
        if (
          allowedOrigins.includes(origin) ||
          origin.endsWith('.vercel.app') ||
          (process.env.VERCEL_URL && origin.includes(process.env.VERCEL_URL))
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Health check endpoint
  app.get('/api/health', async (_req, res) => {
    let redisConnected = false;
    let mysqlConnected = false;

    try {
      redisConnected = redisClient.status === 'ready' || (await redisClient.ping()) === 'PONG';
    } catch {
      redisConnected = false;
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      mysqlConnected = true;
    } catch {
      mysqlConnected = false;
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mysql: mysqlConnected ? 'connected' : 'disconnected',
        redis: redisConnected ? 'connected' : 'disconnected',
        elasticsearch: getEsStatus() ? 'connected' : 'degraded (fallback to db)',
      },
      workerConfig: {
        concurrency: config.worker.concurrency,
        minDelayMs: config.worker.minDelayMs,
        maxEmailsPerHour: config.worker.maxEmailsPerHour,
      },
    });
  });

  // Bull Board Queue Dashboard (Mounted at /admin/queues)
  app.use('/admin/queues', bullBoardRouter);

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/senders', senderRouter);
  app.use('/api/campaigns', campaignRouter);
  app.use('/api/emails', emailRouter);
  app.use('/api/slack', slackRouter);
  app.get('/api/queues/stats', getQueueStatsHandler);


  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
