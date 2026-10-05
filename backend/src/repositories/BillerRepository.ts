import { BaseRepository } from './BaseRepository';
import { IBiller, BillerModel } from '../models/Biller';

export class BillerRepository extends BaseRepository<IBiller> {
  constructor() {
    super(BillerModel);
  }

  async findAllActive(): Promise<IBiller[]> {
    return await this.find({ isActive: true }, { name: 1 });
  }

  async adjustTotalSales(billerId: string, amount: number): Promise<IBiller | null> {
    return await this._model.findByIdAndUpdate(
      billerId,
      { $inc: { totalSales: amount } },
      { new: true }
    ).exec();
  }
}
