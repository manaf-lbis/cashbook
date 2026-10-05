import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { AccountRepository } from '../repositories/AccountRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { ExpenseCategoryModel } from '../models/ExpenseCategory';
import { AccountType, TransactionType, TransactionSource } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import dayjs from 'dayjs';

export class ExpenseService {
  private expenseRepo: ExpenseRepository;
  private accountRepo: AccountRepository;
  private transactionRepo: TransactionRepository;

  constructor() {
    this.expenseRepo = new ExpenseRepository();
    this.accountRepo = new AccountRepository();
    this.transactionRepo = new TransactionRepository();
  }

  async createExpense(dto: {
    title: string;
    amount: number;
    category?: string;
    accountId?: string;
    date?: Date;
    remarks?: string;
    receiptNumber?: string;
  }) {
    if (dto.amount <= 0) throw ApiError.badRequest('Expense amount must be greater than zero');

    let account = null;
    if (dto.accountId) {
      account = await this.accountRepo.findById(dto.accountId);
    } else {
      account = (await this.accountRepo.getCashAccount()) || (await this.accountRepo.findOne({ isActive: true }));
    }
    if (!account) throw ApiError.notFound('Payment account not found');

    if (account.balance < dto.amount) {
      throw ApiError.badRequest(`Insufficient balance in ${account.name}. Available: ₹${account.balance}`);
    }

    const expDate = dto.date || new Date();
    const finalCategory = dto.category || 'Other Expenses';

    // Ensure category is registered in ExpenseCategoryModel
    await ExpenseCategoryModel.findOneAndUpdate(
      { name: { $regex: new RegExp(`^${finalCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      { $setOnInsert: { name: finalCategory } },
      { upsert: true, new: true }
    );

    // 1. Deduct from account balance
    const updatedAccount = await this.accountRepo.adjustBalance(account._id.toString(), -dto.amount);

    // 2. Create Expense record
    const expense = await this.expenseRepo.create({
      title: dto.title,
      amount: dto.amount,
      category: finalCategory,
      accountId: account._id,
      date: expDate,
      remarks: dto.remarks,
      receiptNumber: dto.receiptNumber,
    });

    // 3. Create Master Transaction Journal
    await this.transactionRepo.create({
      accountId: account._id,
      type: TransactionType.OUTFLOW,
      amount: dto.amount,
      source: TransactionSource.EXPENSE,
      referenceId: expense._id,
      description: `Expense: ${dto.title} (${finalCategory})`,
      balanceAfter: updatedAccount?.balance || 0,
      date: expDate,
    });

    return expense;
  }

  async updateExpense(
    id: string,
    dto: {
      title?: string;
      amount?: number;
      category?: string;
      date?: Date | string;
    }
  ) {
    const expense = await this.expenseRepo.findById(id);
    if (!expense) throw ApiError.notFound('Expense not found');

    const previousAmount = expense.amount;
    const newAmount = dto.amount !== undefined ? dto.amount : previousAmount;
    if (newAmount <= 0) throw ApiError.badRequest('Expense amount must be greater than zero');

    const delta = newAmount - previousAmount; // positive means expense increased

    if (delta !== 0) {
      const account = await this.accountRepo.findById(expense.accountId.toString());
      if (account) {
        if (delta > 0 && account.balance < delta) {
          throw ApiError.badRequest(`Insufficient balance in ${account.name} to adjust expense by ₹${delta}`);
        }
        // Adjust account: increasing expense reduces account balance by delta
        const updatedAccount = await this.accountRepo.adjustBalance(expense.accountId.toString(), -delta);

        // Record master journal audit
        await this.transactionRepo.create({
          accountId: account._id,
          type: delta > 0 ? TransactionType.OUTFLOW : TransactionType.INFLOW,
          amount: Math.abs(delta),
          source: TransactionSource.EXPENSE,
          referenceId: expense._id,
          description: `Expense edited: ${expense.title} (Adjusted ₹${previousAmount} ➔ ₹${newAmount})`,
          balanceAfter: updatedAccount?.balance ?? (account.balance - delta),
          date: new Date(),
        });
      }
    }

    if (dto.title?.trim()) expense.title = dto.title.trim();
    if (dto.amount !== undefined) expense.amount = newAmount;
    if (dto.category?.trim()) expense.category = dto.category.trim();
    if (dto.date) expense.date = new Date(dto.date);

    await expense.save();
    return expense;
  }

  async deleteExpense(id: string) {
    throw ApiError.badRequest('Delete operation is disabled. Only editing entries is permitted.');
  }

  async getExpenses(filter: any = {}, limit = 100, skip = 0) {
    return await this.expenseRepo.getExpensesWithDetails(filter, limit, skip);
  }

  async getCategoryBreakdown(startDate?: Date, endDate?: Date) {
    return await this.expenseRepo.getCategoryBreakdown(startDate, endDate);
  }

  async getTotalExpenses(startDate?: Date, endDate?: Date) {
    return await this.expenseRepo.getTotalExpenses(startDate, endDate);
  }

  async getCategoriesWithStats() {
    let categories = await ExpenseCategoryModel.find().sort({ name: 1 });
    if (categories.length === 0) {
      const defaultNames = [
        'Shop Expenses',
        'Courier Expense',
        'Office Supplies',
        'Tea & Refreshments',
        'Utilities & Bills',
        'Transport & Fuel',
        'Other Expenses',
      ];
      for (const name of defaultNames) {
        await ExpenseCategoryModel.create({ name });
      }
      categories = await ExpenseCategoryModel.find().sort({ name: 1 });
    }

    // Also get distinct categories in expenses to ensure all are included
    const existingCatsInExpenses = await this.expenseRepo.distinctCategories();
    for (const catName of existingCatsInExpenses) {
      if (catName && !categories.some((c) => c.name.toLowerCase() === catName.toLowerCase())) {
        const newCat = await ExpenseCategoryModel.create({ name: catName });
        categories.push(newCat);
      }
    }

    // Aggregates for each category
    const statsAgg = await this.expenseRepo.getCategoryAggregates();
    const statsMap: Record<string, { totalSpent: number; count: number; lastExpenseDate: Date | null }> = {};
    for (const stat of statsAgg) {
      statsMap[stat._id] = {
        totalSpent: stat.totalSpent,
        count: stat.count,
        lastExpenseDate: stat.lastExpenseDate,
      };
    }

    return categories.map((cat) => {
      const stat = statsMap[cat.name] || { totalSpent: 0, count: 0, lastExpenseDate: null };
      return {
        _id: cat._id,
        name: cat.name,
        description: cat.description,
        color: cat.color,
        totalSpent: stat.totalSpent,
        count: stat.count,
        lastExpenseDate: stat.lastExpenseDate,
        createdAt: cat.createdAt,
      };
    });
  }

  async createCategory(dto: { name: string; description?: string; color?: string }) {
    if (!dto.name?.trim()) throw ApiError.badRequest('Category / Expense Head name is required');
    const trimmed = dto.name.trim();
    let cat = await ExpenseCategoryModel.findOne({
      name: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (!cat) {
      cat = await ExpenseCategoryModel.create({
        name: trimmed,
        description: dto.description?.trim(),
        color: dto.color,
      });
    }
    return cat;
  }
}
