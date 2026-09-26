import { Router } from 'express';
import { SenderController, createSenderSchema } from '../controllers/senderController';
import { requireAuth } from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validateMiddleware';

export const senderRouter = Router();

senderRouter.use(requireAuth);

senderRouter.get('/', SenderController.getSenders);
senderRouter.post('/', validateBody(createSenderSchema), SenderController.createSender);
senderRouter.delete('/:id', SenderController.deleteSender);
