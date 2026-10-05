import { BaseRepository } from './BaseRepository';
import { CreditCardModel, ICreditCard } from '../models/CreditCard';
import { CreditCardTransactionModel, ICreditCardTransaction } from '../models/CreditCardTransaction';

export class CreditCardRepository extends BaseRepository<ICreditCard> {
  constructor() {
    super(CreditCardModel);
  }

  async getAllCards(): Promise<ICreditCard[]> {
    return await this.find({ isActive: true }, { cardName: 1 });
  }

  async getTotalCardDebt(): Promise<number> {
    const res = await this._model.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, totalDebt: { $sum: '$totalOutstanding' } } },
    ]);
    return res.length > 0 ? res[0].totalDebt : 0;
  }
}

export class CreditCardTransactionRepository extends BaseRepository<ICreditCardTransaction> {
  constructor() {
    super(CreditCardTransactionModel);
  }

  async getTransactionsByCard(cardId: string, limit = 50): Promise<ICreditCardTransaction[]> {
    return await this._model
      .find({ cardId })
      .sort({ date: -1 })
      .limit(limit)
      .populate('depositToAccountId', 'name type')
      .populate('paidFromAccountId', 'name type')
      .exec();
  }
}
