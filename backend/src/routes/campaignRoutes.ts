import { Router } from 'express';
import { CampaignController } from '../controllers/campaignController';
import { requireAuth } from '../middleware/authMiddleware';

export const campaignRouter = Router();

campaignRouter.use(requireAuth);

campaignRouter.get('/', CampaignController.getCampaigns);
campaignRouter.get('/:id', CampaignController.getCampaignById);
campaignRouter.post('/', CampaignController.createCampaign);
