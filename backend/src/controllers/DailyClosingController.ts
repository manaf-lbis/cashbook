import { Request, Response, NextFunction } from 'express';
import { DailyClosingService } from '../services/DailyClosingService';
import { ApiResponse } from '../utils/ApiResponse';
import { getTodayIST } from '../utils/dateUtils';

export class DailyClosingController {
  private closingService: DailyClosingService;

  constructor() {
    this.closingService = new DailyClosingService();
  }

  getLiveSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dateStr = (req.query.date as string)?.trim() || getTodayIST();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return ApiResponse.error(res, 'Invalid date format. Expected YYYY-MM-DD', 400);
      }
      const summary = await this.closingService.getLiveDaySummary(dateStr);
      return ApiResponse.success(res, summary, 'Live day summary computed successfully');
    } catch (err) {
      next(err);
    }
  };

  saveClosing = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.closingService.saveDailyClosing(req.body);
      const msg = result.warningMessage || 'Daily closing record saved and balanced successfully!';
      return ApiResponse.success(res, result, msg);
    } catch (err) {
      next(err);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedLimit = parseInt(req.query.limit as string, 10);
      const limit = isNaN(parsedLimit) ? 60 : Math.min(Math.max(1, parsedLimit), 100);
      const history = await this.closingService.getHistory(limit);
      return ApiResponse.success(res, history, 'Daily closing history retrieved successfully');
    } catch (err) {
      next(err);
    }
  };

  getTimeline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedDays = parseInt(req.query.days as string, 10);
      const days = isNaN(parsedDays) ? 14 : Math.min(Math.max(1, parsedDays), 90);
      const timelineData = await this.closingService.getTimelineHistory(days);
      return ApiResponse.success(res, timelineData, 'Comprehensive timeline history retrieved successfully');
    } catch (err) {
      next(err);
    }
  };
}
