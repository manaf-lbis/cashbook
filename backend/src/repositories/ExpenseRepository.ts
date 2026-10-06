import { BaseRepository } from './BaseRepository';
import { ExpenseModel, IExpense } from '../models/Expense';

export class ExpenseRepository extends BaseRepository<IExpense> {
  constructor() {
    super(ExpenseModel);
  }

  async getExpensesWithDetails(filter: any = {}, limit = 50, skip = 0): Promise<IExpense[]> {
    return await this._model
      .find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('accountId', 'name type bankName')
      .exec();
  }

  async getCategoryBreakdown(startDate?: Date, endDate?: Date): Promise<{ _id: string; totalAmount: number; count: number }[]> {
    const match: any = { isDeleted: { $ne: true } };
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = startDate;
      if (endDate) match.date.$lte = endDate;
    }

    return await this._model.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);
  }

  async getTotalExpenses(startDate?: Date, endDate?: Date): Promise<number> {
    const match: any = { isDeleted: { $ne: true } };
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = startDate;
      if (endDate) match.date.$lte = endDate;
    }

    const res = await this._model.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return res.length > 0 ? res[0].total : 0;
  }

  async distinctCategories(): Promise<string[]> {
    return await this._model.distinct('category', { isDeleted: { $ne: true } });
  }

  async getCategoryAggregates(): Promise<{ _id: string; totalSpent: number; count: number; lastExpenseDate: Date | null }[]> {
    return await this._model.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: '$amount' },
          count: { $sum: 1 },
          lastExpenseDate: { $max: '$date' },
        },
      },
    ]);
  }
}
