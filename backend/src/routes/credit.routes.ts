import { Router } from 'express';
import { CreditController } from '../controllers/CreditController';
import { validateRequest } from '../middlewares/validateRequest';
import { GiveCreditSchema, RepayCreditSchema, UpdateCreditEntrySchema } from '../validators/schemas';

const router = Router();
const controller = new CreditController();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/give', validateRequest(GiveCreditSchema), controller.giveCredit);
router.post('/:id/repay', validateRequest(RepayCreditSchema), controller.collectRepayment);
router.put('/:id/entries/:entryId', validateRequest(UpdateCreditEntrySchema), controller.updateEntry);
router.delete('/:id/entries/:entryId', controller.deleteEntry);

export default router;
