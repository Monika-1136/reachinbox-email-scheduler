import { Router } from 'express';
import { SlackController } from '../controllers/slackController';
import { requireAuth } from '../middleware/authMiddleware';

export const slackRouter = Router();

slackRouter.get('/connect', requireAuth, SlackController.connect);
slackRouter.get('/callback', SlackController.callback);
slackRouter.post('/disconnect', requireAuth, SlackController.disconnect);
slackRouter.get('/status', requireAuth, SlackController.getStatus);
