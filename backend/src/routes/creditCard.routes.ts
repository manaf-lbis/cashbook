import { Router } from 'express';
import { CreditCardController } from '../controllers/CreditCardController';
import { validateRequest } from '../middlewares/validateRequest';
import { validateObjectIdParams } from '../middlewares/validateObjectId';
import { CreateCardSchema, UpdateCardSchema, CardTransactionSchema, UpdateCardTransactionSchema } from '../validators/schemas';

const router = Router();
const controller = new CreditCardController();

router.get('/', controller.getAll);
router.get('/:id', validateObjectIdParams(['id']), controller.getById);
router.get('/:id/transactions', validateObjectIdParams(['id']), controller.getTransactions);
router.post('/', validateRequest(CreateCardSchema), controller.create);
router.put('/:id', validateObjectIdParams(['id']), validateRequest(UpdateCardSchema), controller.update);
router.post('/transaction', validateRequest(CardTransactionSchema), controller.recordTransaction);
router.put('/transactions/:txId', validateObjectIdParams(['txId']), validateRequest(UpdateCardTransactionSchema), controller.updateTransaction);

export default router;

