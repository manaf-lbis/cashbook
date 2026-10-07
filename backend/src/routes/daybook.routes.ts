import { Router } from 'express';
import { DayBookController } from '../controllers/DayBookController';
import { validateRequest } from '../middlewares/validateRequest';
import { validateObjectIdParams } from '../middlewares/validateObjectId';
import { requireRole } from '../middlewares/roleMiddleware';
import { CreateBillerSchema, CreateDayBookEntrySchema, UpdateDayBookEntrySchema } from '../validators/schemas';

const router = Router();
const controller = new DayBookController();

router.get('/months', controller.getMonths);
router.get('/billers', controller.getBillers);
router.get('/billers/:billerId/entries', validateObjectIdParams(['billerId']), controller.getEntries);
router.post('/billers', validateRequest(CreateBillerSchema), controller.createBiller);
router.post('/entries', validateRequest(CreateDayBookEntrySchema), controller.createEntry);
router.put('/entries/:id', validateObjectIdParams(['id']), validateRequest(UpdateDayBookEntrySchema), controller.updateEntry);
router.delete('/entries/:id', validateObjectIdParams(['id']), requireRole('ADMIN'), controller.deleteEntry);

export default router;

