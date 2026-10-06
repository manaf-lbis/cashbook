import { Router } from 'express';
import { AccountController } from '../controllers/AccountController';
const router = Router();
const controller = new AccountController();

router.get('/', controller.getAll);
router.get('/liquidity', controller.getLiquidity);

export default router;
