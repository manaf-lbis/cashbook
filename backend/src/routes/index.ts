import { Router } from 'express';
import authRoutes from './auth.routes';
import accountRoutes from './account.routes';
import expenseRoutes from './expense.routes';
import creditRoutes from './credit.routes';
import payableRoutes from './payable.routes';
import creditCardRoutes from './creditCard.routes';
import dashboardRoutes from './dashboard.routes';
import daybookRoutes from './daybook.routes';
import dailyClosingRoutes from './dailyClosing.routes';
import { requireAuth } from '../middlewares/authMiddleware';

const apiRouter = Router();

// Public authentication routes
apiRouter.use('/auth', authRoutes);

// Secure routes protected with requireAuth
apiRouter.use('/accounts', requireAuth, accountRoutes);
apiRouter.use('/expenses', requireAuth, expenseRoutes);
apiRouter.use('/credits', requireAuth, creditRoutes);
apiRouter.use('/payables', requireAuth, payableRoutes);
apiRouter.use('/credit-cards', requireAuth, creditCardRoutes);
apiRouter.use('/dashboard', requireAuth, dashboardRoutes);
apiRouter.use('/daybook', requireAuth, daybookRoutes);
apiRouter.use('/daily-closing', requireAuth, dailyClosingRoutes);

export default apiRouter;

