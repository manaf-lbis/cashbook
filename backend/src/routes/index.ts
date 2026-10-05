import { Router } from 'express';
import accountRoutes from './account.routes';
import expenseRoutes from './expense.routes';
import creditRoutes from './credit.routes';
import payableRoutes from './payable.routes';
import creditCardRoutes from './creditCard.routes';
import dashboardRoutes from './dashboard.routes';
import daybookRoutes from './daybook.routes';
import dailyClosingRoutes from './dailyClosing.routes';

const apiRouter = Router();

apiRouter.use('/accounts', accountRoutes);
apiRouter.use('/expenses', expenseRoutes);
apiRouter.use('/credits', creditRoutes);
apiRouter.use('/payables', payableRoutes);
apiRouter.use('/credit-cards', creditCardRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/daybook', daybookRoutes);
apiRouter.use('/daily-closing', dailyClosingRoutes);

export default apiRouter;
