import mongoose from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { IDayBookEntry, DayBookEntryModel } from '../models/DayBookEntry';

export class DayBookRepository extends BaseRepository<IDayBookEntry> {
  constructor() {
    super(DayBookEntryModel);
  }

  async findByBillerAndMonth(billerId: string, monthKey: string): Promise<IDayBookEntry[]> {
    return await this.find(
      { billerId: new mongoose.Types.ObjectId(billerId), monthKey },
      { date: -1, createdAt: -1 },
      undefined,
      undefined,
      'accountId'
    );
  }

  async findByMonth(monthKey: string): Promise<IDayBookEntry[]> {
    return await this.find(
      { monthKey },
      { date: -1, createdAt: -1 },
      undefined,
      undefined,
      ['billerId', 'accountId']
    );
  }

  async getMonthAggregates(monthKey: string) {
    const result = await this._model.aggregate([
      { $match: { monthKey, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$amount' },
          totalBills: { $sum: 1 },
        },
      },
    ]);

    return {
      totalSales: result[0]?.totalSales || 0,
      totalBills: result[0]?.totalBills || 0,
    };
  }

  async getBillerMonthSums(monthKey: string): Promise<Record<string, { totalSales: number; totalBills: number }>> {
    const rows = await this._model.aggregate([
      { $match: { monthKey, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$billerId',
          totalSales: { $sum: '$amount' },
          totalBills: { $sum: 1 },
        },
      },
    ]);

    const map: Record<string, { totalSales: number; totalBills: number }> = {};
    for (const row of rows) {
      if (row._id) {
        map[row._id.toString()] = {
          totalSales: row.totalSales,
          totalBills: row.totalBills,
        };
      }
    }
    return map;
  }
}
