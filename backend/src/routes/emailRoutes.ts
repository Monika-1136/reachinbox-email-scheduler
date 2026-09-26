import { Router } from 'express';
import { EmailController, scheduleEmailSchema } from '../controllers/emailController';
import { requireAuth } from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validateMiddleware';

export const emailRouter = Router();

emailRouter.use(requireAuth);

emailRouter.post('/schedule', validateBody(scheduleEmailSchema), EmailController.schedule);
emailRouter.get('/scheduled', EmailController.getScheduled);
emailRouter.get('/sent', EmailController.getSent);
emailRouter.get('/search', EmailController.search);
emailRouter.get('/stats', EmailController.getStats);
emailRouter.post('/parse-csv', EmailController.parseCsv);
emailRouter.get('/:id', EmailController.getById);
emailRouter.delete('/:id', EmailController.cancel);
