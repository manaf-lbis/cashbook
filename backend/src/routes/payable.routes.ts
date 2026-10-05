import { Router } from 'express';
import { PayableController } from '../controllers/PayableController';
import { validateRequest } from '../middlewares/validateRequest';
import { BorrowPayableSchema, PayBackPayableSchema, UpdatePayableEntrySchema } from '../validators/schemas';

const router = Router();
const controller = new PayableController();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/borrow', validateRequest(BorrowPayableSchema), controller.borrow);
router.post('/:id/payback', validateRequest(PayBackPayableSchema), controller.payBack);
router.put('/:id/entries/:entryId', validateRequest(UpdatePayableEntrySchema), controller.updateEntry);

export default router;
