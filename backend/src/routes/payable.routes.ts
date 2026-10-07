import { Router } from 'express';
import { PayableController } from '../controllers/PayableController';
import { validateRequest } from '../middlewares/validateRequest';
import { validateObjectIdParams } from '../middlewares/validateObjectId';
import { BorrowPayableSchema, PayBackPayableSchema, UpdatePayableEntrySchema } from '../validators/schemas';

const router = Router();
const controller = new PayableController();

router.get('/', controller.getAll);
router.get('/:id', validateObjectIdParams(['id']), controller.getById);
router.post('/borrow', validateRequest(BorrowPayableSchema), controller.borrow);
router.post('/:id/payback', validateObjectIdParams(['id']), validateRequest(PayBackPayableSchema), controller.payBack);
router.put('/:id/entries/:entryId', validateObjectIdParams(['id', 'entryId']), validateRequest(UpdatePayableEntrySchema), controller.updateEntry);
router.delete('/:id/entries/:entryId', validateObjectIdParams(['id', 'entryId']), controller.deleteEntry);

export default router;

