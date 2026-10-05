import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';

const router = Router();
const controller = new DashboardController();

router.get('/summary', controller.getSummary);

export default router;
