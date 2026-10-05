import { BaseRepository } from './BaseRepository';
import { TransactionModel, ITransaction } from '../models/Transaction';

export class TransactionRepository extends BaseRepository<ITransaction> {
  constructor() {
    super(TransactionModel);
  }

  async getRecent(limit = 20): Promise<ITransaction[]> {
    return await this._model
      .find()
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate('accountId', 'name type bankName')
      .populate('destinationAccountId', 'name type bankName')
      .exec();
  }

  async getByAccount(accountId: string, limit = 50): Promise<ITransaction[]> {
    return await this._model
      .find({ accountId })
      .sort({ date: -1 })
      .limit(limit)
      .populate('destinationAccountId', 'name type')
      .exec();
  }
}
