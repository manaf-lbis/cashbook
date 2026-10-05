import { BaseRepository } from './BaseRepository';
import { DailyClosingModel, IDailyClosing } from '../models/DailyClosing';

export class DailyClosingRepository extends BaseRepository<IDailyClosing> {
  constructor() {
    super(DailyClosingModel);
  }

  async findByDate(dateStr: string): Promise<IDailyClosing | null> {
    return await this._model.findOne({ date: dateStr }).exec();
  }

  async findPreviousClosing(dateStr: string): Promise<IDailyClosing | null> {
    return await this._model
      .findOne({ date: { $lt: dateStr } })
      .sort({ date: -1 })
      .exec();
  }

  async getClosingHistory(limit = 30): Promise<IDailyClosing[]> {
    return await this._model
      .find()
      .sort({ date: -1 })
      .limit(limit)
      .exec();
  }
}
