import { Request, Response, NextFunction } from 'express';
import { AccountService } from '../services/AccountService';
import { ApiResponse } from '../utils/ApiResponse';

export class AccountController {
  private accountService: AccountService;

  constructor() {
    this.accountService = new AccountService();
  }

  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const accounts = await this.accountService.getAllAccounts();
      return ApiResponse.success(res, accounts, 'Accounts retrieved');
    } catch (err) {
      next(err);
    }
  };

  getLiquidity = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await this.accountService.getLiquiditySummary();
      return ApiResponse.success(res, summary, 'Liquidity summary retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await this.accountService.createAccount(req.body);
      return ApiResponse.created(res, account, 'Account created successfully');
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await this.accountService.updateAccount(req.params.id, req.body);
      return ApiResponse.success(res, account, 'Account updated successfully');
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.accountService.deleteAccount(req.params.id);
      return ApiResponse.success(res, null, 'Account deleted successfully');
    } catch (err) {
      next(err);
    }
  };

  transfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.accountService.transferFunds(req.body);
      return ApiResponse.success(res, result, 'Funds transferred successfully');
    } catch (err) {
      next(err);
    }
  };
}
