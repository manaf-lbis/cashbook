import { Router } from 'express';
import { DailyClosingController } from '../controllers/DailyClosingController';
import { validateRequest } from '../middlewares/validateRequest';
import { SaveDailyClosingSchema } from '../validators/schemas';

const router = Router();
const controller = new DailyClosingController();

router.get('/summary', controller.getLiveSummary);
router.get('/history', controller.getHistory);
router.get('/timeline', controller.getTimeline);
router.post('/', validateRequest(SaveDailyClosingSchema), controller.saveClosing);

export default router;
