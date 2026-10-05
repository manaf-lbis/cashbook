import { Request, Response, NextFunction } from 'express';
import { DailyClosingService } from '../services/DailyClosingService';
import { ApiResponse } from '../utils/ApiResponse';
import dayjs from 'dayjs';

export class DailyClosingController {
  private closingService: DailyClosingService;

  constructor() {
    this.closingService = new DailyClosingService();
  }

  getLiveSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dateStr = (req.query.date as string) || dayjs().format('YYYY-MM-DD');
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
      const limit = parseInt(req.query.limit as string) || 60;
      const history = await this.closingService.getHistory(limit);
      return ApiResponse.success(res, history, 'Daily closing history retrieved successfully');
    } catch (err) {
      next(err);
    }
  };

  getTimeline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseInt(req.query.days as string) || 14;
      const timelineData = await this.closingService.getTimelineHistory(days);
      return ApiResponse.success(res, timelineData, 'Comprehensive timeline history retrieved successfully');
    } catch (err) {
      next(err);
    }
  };
}
