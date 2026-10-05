import { Request, Response, NextFunction } from 'express';
import { CreditService } from '../services/CreditService';
import { ApiResponse } from '../utils/ApiResponse';

export class CreditController {
  private creditService: CreditService;

  constructor() {
    this.creditService = new CreditService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: any = {};
      if (req.query.status) filter.status = req.query.status;
      const credits = await this.creditService.getAllCredits(filter);
      return ApiResponse.success(res, credits, 'Credits retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const credit = await this.creditService.getCreditById(req.params.id);
      return ApiResponse.success(res, credit, 'Credit record retrieved');
    } catch (err) {
      next(err);
    }
  };

  giveCredit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const credit = await this.creditService.giveCredit(req.body);
      return ApiResponse.created(res, credit, 'Credit given recorded');
    } catch (err) {
      next(err);
    }
  };

  collectRepayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const credit = await this.creditService.collectRepayment(req.params.id, req.body);
      return ApiResponse.success(res, credit, 'Repayment recorded successfully');
    } catch (err) {
      next(err);
    }
  };

  updateEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, entryId } = req.params;
      const credit = await this.creditService.updateCreditEntry(id, entryId, req.body);
      return ApiResponse.success(res, credit, 'Credit entry updated successfully');
    } catch (err) {
      next(err);
    }
  };
}
