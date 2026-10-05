import { BaseRepository } from './BaseRepository';
import { CreditModel, ICredit } from '../models/Credit';

export class CreditRepository extends BaseRepository<ICredit> {
  constructor() {
    super(CreditModel);
  }

  async getCreditsWithAccounts(filter: any = {}): Promise<ICredit[]> {
    return await this._model
      .find(filter)
      .sort({ balanceDue: -1, updatedAt: -1 })
      .populate('entries.accountId', 'name type')
      .exec();
  }

  async getTotalOutstandingReceivables(): Promise<number> {
    const res = await this._model.aggregate([
      { $match: { status: 'ACTIVE' } },
      { $group: { _id: null, total: { $sum: '$balanceDue' } } },
    ]);
    return res.length > 0 ? res[0].total : 0;
  }
}
