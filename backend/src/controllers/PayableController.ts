import { Request, Response, NextFunction } from 'express';
import { PayableService } from '../services/PayableService';
import { ApiResponse } from '../utils/ApiResponse';

export class PayableController {
  private payableService: PayableService;

  constructor() {
    this.payableService = new PayableService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: any = {};
      if (req.query.status) filter.status = req.query.status;
      const payables = await this.payableService.getAllPayables(filter);
      return ApiResponse.success(res, payables, 'Pending payments retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payable = await this.payableService.getPayableById(req.params.id);
      return ApiResponse.success(res, payable, 'Pending record retrieved');
    } catch (err) {
      next(err);
    }
  };

  borrow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payable = await this.payableService.borrowFunds(req.body);
      return ApiResponse.created(res, payable, 'Borrowed payment recorded');
    } catch (err) {
      next(err);
    }
  };

  payBack = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payable = await this.payableService.payBackPending(req.params.id, req.body);
      return ApiResponse.success(res, payable, 'Payment payback recorded successfully');
    } catch (err) {
      next(err);
    }
  };

  updateEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, entryId } = req.params;
      const payable = await this.payableService.updatePayableEntry(id, entryId, req.body);
      return ApiResponse.success(res, payable, 'Payable entry updated successfully');
    } catch (err) {
      next(err);
    }
  };

  deleteEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, entryId } = req.params;
      const payable = await this.payableService.deletePayableEntry(id, entryId);
      return ApiResponse.success(res, payable, 'Payable entry marked as deleted successfully');
    } catch (err) {
      next(err);
    }
  };
}
