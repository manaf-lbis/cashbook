import { Router } from 'express';
import { CreditCardController } from '../controllers/CreditCardController';
import { validateRequest } from '../middlewares/validateRequest';
import { CreateCardSchema, CardTransactionSchema, UpdateCardTransactionSchema } from '../validators/schemas';

const router = Router();
const controller = new CreditCardController();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.get('/:id/transactions', controller.getTransactions);
router.post('/', validateRequest(CreateCardSchema), controller.create);
router.put('/:id', controller.update);
router.post('/transaction', validateRequest(CardTransactionSchema), controller.recordTransaction);
router.put('/transactions/:txId', validateRequest(UpdateCardTransactionSchema), controller.updateTransaction);

export default router;
