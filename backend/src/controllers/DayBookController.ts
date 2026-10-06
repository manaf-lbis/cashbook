import { Request, Response, NextFunction } from 'express';
import dayjs from 'dayjs';
import { DayBookService } from '../services/DayBookService';
import { ApiResponse } from '../utils/ApiResponse';

export class DayBookController {
  private daybookService: DayBookService;

  constructor() {
    this.daybookService = new DayBookService();
  }

  getMonths = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const months = await this.daybookService.getMonthsList(year);
      return ApiResponse.success(res, months, 'Months list retrieved');
    } catch (err) {
      next(err);
    }
  };

  getBillers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const monthKey = (req.query.month as string) || dayjs().format('YYYY-MM');
      const data = await this.daybookService.getBillersWithMonthStats(monthKey);
      return ApiResponse.success(res, data, 'Billers with month statistics retrieved');
    } catch (err) {
      next(err);
    }
  };

  getEntries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { billerId } = req.params;
      const monthKey = (req.query.month as string) || dayjs().format('YYYY-MM');
      const data = await this.daybookService.getBillerEntries(billerId, monthKey);
      return ApiResponse.success(res, data, 'Biller sales entries retrieved');
    } catch (err) {
      next(err);
    }
  };

  createEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await this.daybookService.createSalesEntry(req.body);
      return ApiResponse.created(res, entry, 'Sales entry recorded successfully');
    } catch (err) {
      next(err);
    }
  };

  createBiller = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const biller = await this.daybookService.createBiller(req.body);
      return ApiResponse.created(res, biller, 'Billing person added successfully');
    } catch (err) {
      next(err);
    }
  };

  updateEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updated = await this.daybookService.updateSalesEntry(id, req.body);
      return ApiResponse.success(res, updated, 'Sales entry updated successfully');
    } catch (err) {
      next(err);
    }
  };

  deleteEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const reason = req.body?.reason || req.query?.reason;
      const deleted = await this.daybookService.deleteSalesEntry(id, reason as string);
      return ApiResponse.success(res, deleted, 'Sales entry marked as deleted successfully');
    } catch (err) {
      next(err);
    }
  };
}
