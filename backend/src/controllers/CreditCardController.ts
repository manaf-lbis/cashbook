import { Request, Response, NextFunction } from 'express';
import { CreditCardService } from '../services/CreditCardService';
import { ApiResponse } from '../utils/ApiResponse';

export class CreditCardController {
  private cardService: CreditCardService;

  constructor() {
    this.cardService = new CreditCardService();
  }

  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const cards = await this.cardService.getAllCards();
      return ApiResponse.success(res, cards, 'Credit cards retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = await this.cardService.getCardById(req.params.id);
      return ApiResponse.success(res, card, 'Card details retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = await this.cardService.createCard(req.body);
      return ApiResponse.created(res, card, 'Credit card added successfully');
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = await this.cardService.updateCard(req.params.id, req.body);
      return ApiResponse.success(res, card, 'Credit card updated');
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.cardService.deleteCard(req.params.id);
      return ApiResponse.success(res, null, 'Credit card deleted');
    } catch (err) {
      next(err);
    }
  };

  recordTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.cardService.recordTransaction(req.body);
      return ApiResponse.created(res, result, 'Card transaction recorded');
    } catch (err) {
      next(err);
    }
  };

  getTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transactions = await this.cardService.getCardTransactions(req.params.id);
      return ApiResponse.success(res, transactions, 'Card transactions retrieved');
    } catch (err) {
      next(err);
    }
  };

  updateTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.cardService.updateTransaction(req.params.txId, req.body);
      return ApiResponse.success(res, result, 'Card transaction updated successfully');
    } catch (err) {
      next(err);
    }
  };
}
