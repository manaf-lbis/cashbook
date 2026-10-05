import { Request, Response, NextFunction } from 'express';
import { ExpenseService } from '../services/ExpenseService';
import { ApiResponse } from '../utils/ApiResponse';

export class ExpenseController {
  private expenseService: ExpenseService;

  constructor() {
    this.expenseService = new ExpenseService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: any = {};
      if (req.query.category) filter.category = req.query.category;
      if (req.query.accountId) filter.accountId = req.query.accountId;
      if (req.query.startDate || req.query.endDate) {
        filter.date = {};
        if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate as string);
        if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate as string);
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

      const expenses = await this.expenseService.getExpenses(filter, limit, skip);
      return ApiResponse.success(res, expenses, 'Expenses retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await this.expenseService.createExpense(req.body);
      return ApiResponse.created(res, expense, 'Expense recorded successfully');
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await this.expenseService.updateExpense(req.params.id, req.body);
      return ApiResponse.success(res, updated, 'Expense updated successfully');
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.expenseService.deleteExpense(req.params.id);
      return ApiResponse.success(res, result, 'Expense deleted');
    } catch (err) {
      next(err);
    }
  };

  getCategoryStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const stats = await this.expenseService.getCategoryBreakdown(startDate, endDate);
      return ApiResponse.success(res, stats, 'Category breakdown retrieved');
    } catch (err) {
      next(err);
    }
  };

  getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.expenseService.getCategoriesWithStats();
      return ApiResponse.success(res, categories, 'Expense categories retrieved');
    } catch (err) {
      next(err);
    }
  };

  createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await this.expenseService.createCategory(req.body);
      return ApiResponse.created(res, category, 'Expense category created');
    } catch (err) {
      next(err);
    }
  };
}
