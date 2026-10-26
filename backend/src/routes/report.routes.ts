import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { validateRequest } from '../middlewares/validateRequest';
import { SalesReportQuerySchema } from '../validators/schemas';

const router = Router();
const controller = new ReportController();

router.get('/sales', validateRequest(SalesReportQuerySchema, 'query'), controller.getSalesReport);
router.get('/sales/export', validateRequest(SalesReportQuerySchema, 'query'), controller.exportSalesReportCSV);

export default router;
