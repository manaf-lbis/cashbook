import { BaseRepository } from './BaseRepository';
import { PayableModel, IPayable } from '../models/Payable';

export class PayableRepository extends BaseRepository<IPayable> {
  constructor() {
    super(PayableModel);
  }

  async getPayablesWithAccounts(filter: any = {}): Promise<IPayable[]> {
    return await this._model
      .find(filter)
      .sort({ balancePending: -1, updatedAt: -1 })
      .populate('entries.accountId', 'name type')
      .exec();
  }

  async getTotalOutstandingPayables(): Promise<number> {
    const res = await this._model.aggregate([
      { $match: { status: 'ACTIVE' } },
      { $group: { _id: null, total: { $sum: '$balancePending' } } },
    ]);
    return res.length > 0 ? res[0].total : 0;
  }
}
