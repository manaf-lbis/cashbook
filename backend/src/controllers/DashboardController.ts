import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/DashboardService';
import { ApiResponse } from '../utils/ApiResponse';

export class DashboardController {
  private dashboardService: DashboardService;

  constructor() {
    this.dashboardService = new DashboardService();
  }

  getSummary = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await this.dashboardService.getDashboardSummary();
      return ApiResponse.success(res, summary, 'Dashboard summary retrieved');
    } catch (err) {
      next(err);
    }
  };
}
