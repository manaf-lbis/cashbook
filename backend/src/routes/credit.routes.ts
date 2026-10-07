import { Router } from 'express';
import { CreditController } from '../controllers/CreditController';
import { validateRequest } from '../middlewares/validateRequest';
import { validateObjectIdParams } from '../middlewares/validateObjectId';
import { GiveCreditSchema, RepayCreditSchema, UpdateCreditEntrySchema } from '../validators/schemas';

const router = Router();
const controller = new CreditController();

router.get('/', controller.getAll);
router.get('/:id', validateObjectIdParams(['id']), controller.getById);
router.post('/give', validateRequest(GiveCreditSchema), controller.giveCredit);
router.post('/:id/repay', validateObjectIdParams(['id']), validateRequest(RepayCreditSchema), controller.collectRepayment);
router.put('/:id/entries/:entryId', validateObjectIdParams(['id', 'entryId']), validateRequest(UpdateCreditEntrySchema), controller.updateEntry);
router.delete('/:id/entries/:entryId', validateObjectIdParams(['id', 'entryId']), controller.deleteEntry);

export default router;

