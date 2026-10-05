import { Router } from 'express';
import { AccountController } from '../controllers/AccountController';
import { validateRequest } from '../middlewares/validateRequest';
import { CreateAccountSchema, TransferFundsSchema } from '../validators/schemas';

const router = Router();
const controller = new AccountController();

router.get('/', controller.getAll);
router.get('/liquidity', controller.getLiquidity);
router.post('/', validateRequest(CreateAccountSchema), controller.create);
router.post('/transfer', validateRequest(TransferFundsSchema), controller.transfer);
router.put('/:id', controller.update);
// Deletions are strictly disabled across the application

export default router;
