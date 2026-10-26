import { Router } from 'express';
import { ExpenseController } from '../controllers/ExpenseController';
import { validateRequest } from '../middlewares/validateRequest';
import { validateObjectIdParams } from '../middlewares/validateObjectId';
import { requireRole } from '../middlewares/roleMiddleware';
import { CreateExpenseSchema, UpdateExpenseSchema, CreateCategorySchema } from '../validators/schemas';

const router = Router();
const controller = new ExpenseController();

router.get('/', controller.getAll);
router.get('/stats', controller.getCategoryStats);
router.get('/categories', controller.getCategories);
router.post('/categories', validateRequest(CreateCategorySchema), controller.createCategory);
router.post('/', validateRequest(CreateExpenseSchema), controller.create);
router.put('/:id', validateObjectIdParams(['id']), validateRequest(UpdateExpenseSchema), controller.update);
router.delete('/:id', validateObjectIdParams(['id']), requireRole('ADMIN'), controller.delete);

export default router;

