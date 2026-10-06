import dayjs from 'dayjs';
import { BillerRepository } from '../repositories/BillerRepository';
import { DayBookRepository } from '../repositories/DayBookRepository';
import { AccountRepository } from '../repositories/AccountRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { AccountType, TransactionType, TransactionSource } from '../constants/enums';
import { ApiError } from '../utils/ApiError';

export class DayBookService {
  private billerRepo: BillerRepository;
  private daybookRepo: DayBookRepository;
  private accountRepo: AccountRepository;
  private transactionRepo: TransactionRepository;

  constructor() {
    this.billerRepo = new BillerRepository();
    this.daybookRepo = new DayBookRepository();
    this.accountRepo = new AccountRepository();
    this.transactionRepo = new TransactionRepository();
  }

  getMonthStatus(monthKey: string): 'LOCKED' | 'ACTIVE' | 'VIEW_ONLY' {
    const currentMonth = dayjs().format('YYYY-MM');
    if (monthKey > currentMonth) return 'LOCKED';
    if (monthKey === currentMonth) return 'ACTIVE';
    return 'VIEW_ONLY';
  }

  async getMonthsList(year?: number) {
    const targetYear = year || dayjs().year();
    const currentMonth = dayjs().format('YYYY-MM');
    const months = [];

    for (let m = 1; m <= 12; m++) {
      const monthKey = `${targetYear}-${String(m).padStart(2, '0')}`;
      const dateObj = dayjs(`${monthKey}-01`);
      const status = this.getMonthStatus(monthKey);
      const aggregates = status !== 'LOCKED' ? await this.daybookRepo.getMonthAggregates(monthKey) : { totalSales: 0, totalBills: 0 };

      months.push({
        monthKey,
        monthName: dateObj.format('MMMM'),
        year: targetYear,
        label: dateObj.format('MMMM YYYY'),
        shortLabel: dateObj.format('MMM YYYY'),
        status,
        isCurrent: monthKey === currentMonth,
        totalSales: aggregates.totalSales,
        totalBills: aggregates.totalBills,
      });
    }

    return months;
  }

  async getBillersWithMonthStats(monthKey: string) {
    const billers = await this.billerRepo.findAllActive();
    const billerStats = await this.daybookRepo.getBillerMonthSums(monthKey);
    const monthAggregates = await this.daybookRepo.getMonthAggregates(monthKey);
    const monthStatus = this.getMonthStatus(monthKey);

    const billersWithStats = billers.map((b) => {
      const bId = b._id.toString();
      const stats = billerStats[bId] || { totalSales: 0, totalBills: 0 };
      return {
        _id: b._id,
        name: b.name,
        phone: b.phone,
        role: b.role,
        isActive: b.isActive,
        allTimeSales: b.totalSales,
        monthSales: stats.totalSales,
        monthBills: stats.totalBills,
        createdAt: b.createdAt,
      };
    });

    return {
      monthKey,
      monthStatus,
      totalMonthSales: monthAggregates.totalSales,
      totalMonthBills: monthAggregates.totalBills,
      billers: billersWithStats,
    };
  }

  async getBillerEntries(billerId: string, monthKey: string) {
    const biller = await this.billerRepo.findById(billerId);
    if (!biller) throw ApiError.notFound('Billing person not found');

    const entries = await this.daybookRepo.findByBillerAndMonth(billerId, monthKey);
    return {
      biller,
      monthKey,
      monthStatus: this.getMonthStatus(monthKey),
      entries,
    };
  }

  async createSalesEntry(dto: {
    billerId?: string;
    amount: number;
    accountId?: string;
    date?: Date | string;
    paymentMode?: 'CASH' | 'BANK' | 'UPI';
    billNumber?: string;
    customerName?: string;
    remarks?: string;
    description?: string;
  }) {
    if (dto.amount <= 0) throw ApiError.badRequest('Sale amount must be greater than zero');

    const entryDate = dto.date ? new Date(dto.date) : new Date();
    const monthKey = dayjs(entryDate).format('YYYY-MM');
    const status = this.getMonthStatus(monthKey);

    if (status === 'LOCKED') {
      throw ApiError.badRequest('Cannot add entries to future months. This month is locked.');
    }
    if (status === 'VIEW_ONLY') {
      throw ApiError.badRequest('Previous months are view only and cannot be modified.');
    }

    let biller = null;
    if (dto.billerId) {
      biller = await this.billerRepo.findById(dto.billerId);
    } else {
      const activeBillers = await this.billerRepo.findAllActive();
      if (activeBillers.length > 0) {
        biller = activeBillers[0];
      } else {
        biller = await this.billerRepo.create({
          name: 'Main Counter',
          role: 'Cashier',
          isActive: true,
          totalSales: 0,
        });
      }
    }
    if (!biller) throw ApiError.notFound('Billing person not found');

    // All daybook sales go directly to the physical Cash Counter Drawer (no bank account management)
    let account = (await this.accountRepo.getCashAccount()) || (await this.accountRepo.findOne({ isActive: true }));
    if (!account) {
      account = await this.accountRepo.create({
        name: 'Cash Counter Drawer',
        type: AccountType.CASH,
        balance: 0,
        isActive: true,
        isDefaultCash: true,
      });
    }

    const dateStr = dayjs(entryDate).format('YYYY-MM-DD');
    const finalRemarks = dto.remarks || dto.description || undefined;

    // 1. Inflow to cash drawer balance
    const updatedAccount = await this.accountRepo.adjustBalance(account._id.toString(), dto.amount);

    // 2. Create DayBook sales entry
    const entry = await this.daybookRepo.create({
      billerId: biller._id,
      amount: dto.amount,
      accountId: account._id,
      paymentMode: 'CASH',
      date: entryDate,
      monthKey,
      billNumber: dto.billNumber,
      customerName: dto.customerName,
      remarks: finalRemarks,
    });

    // 4. Update biller cumulative total sales
    await this.billerRepo.adjustTotalSales(biller._id.toString(), dto.amount);

    // 5. Create master transaction journal
    await this.transactionRepo.create({
      accountId: account._id,
      type: TransactionType.INFLOW,
      amount: dto.amount,
      source: TransactionSource.DAYBOOK_SALE,
      description: `Day Book Sale: ${biller.name}${dto.billNumber ? ` (Bill #${dto.billNumber})` : ''}${dto.customerName ? ` - ${dto.customerName}` : ''}${finalRemarks ? ` [${finalRemarks}]` : ''}`,
      balanceAfter: updatedAccount?.balance ?? account.balance + dto.amount,
      date: entryDate,
    });

    return await this.daybookRepo.findById(entry._id.toString(), 'accountId');
  }

  async createBiller(dto: { name: string; phone?: string; role?: string }) {
    if (!dto.name?.trim()) throw ApiError.badRequest('Biller name is required');
    return await this.billerRepo.create({
      name: dto.name.trim(),
      phone: dto.phone?.trim(),
      role: dto.role?.trim() || 'Billing Counter',
      isActive: true,
      totalSales: 0,
    });
  }

  async updateSalesEntry(
    id: string,
    dto: {
      amount?: number;
      paymentMode?: 'CASH' | 'BANK' | 'UPI';
      date?: Date | string;
      billNumber?: string;
      customerName?: string;
      remarks?: string;
      description?: string;
      note?: string;
    }
  ) {
    const entry = await this.daybookRepo.findById(id);
    if (!entry) throw ApiError.notFound('Sales entry not found');

    const monthStatus = this.getMonthStatus(entry.monthKey);
    if (monthStatus === 'LOCKED') {
      throw ApiError.badRequest('Cannot edit entries in locked future months.');
    }
    if (monthStatus === 'VIEW_ONLY') {
      throw ApiError.badRequest('Previous months are view-only and cannot be modified.');
    }

    const previousAmount = entry.amount;
    const newAmount = dto.amount !== undefined ? dto.amount : previousAmount;
    if (newAmount <= 0) throw ApiError.badRequest('Sale amount must be greater than zero');

    const finalRemarks =
      dto.remarks !== undefined || dto.description !== undefined
        ? dto.remarks || dto.description || ''
        : entry.remarks;

    const delta = newAmount - previousAmount;

    // If amount changed, adjust account balance and biller total sales
    if (delta !== 0) {
      const updatedAccount = await this.accountRepo.adjustBalance(entry.accountId.toString(), delta);
      await this.billerRepo.adjustTotalSales(entry.billerId.toString(), delta);

      // Record transaction journal for audit
      await this.transactionRepo.create({
        accountId: entry.accountId,
        type: delta > 0 ? TransactionType.INFLOW : TransactionType.OUTFLOW,
        amount: Math.abs(delta),
        source: TransactionSource.DAYBOOK_SALE,
        description: `Day Book Sale Edited: Adjusted ₹${previousAmount} ➔ ₹${newAmount}${
          dto.note ? ` (${dto.note})` : ''
        }`,
        balanceAfter: updatedAccount?.balance ?? 0,
        date: new Date(),
      });
    }

    const editLog = {
      editedAt: new Date(),
      previousAmount,
      newAmount,
      previousRemarks: entry.remarks,
      newRemarks: finalRemarks,
      previousCustomerName: entry.customerName,
      newCustomerName: dto.customerName !== undefined ? dto.customerName : entry.customerName,
      previousBillNumber: entry.billNumber,
      newBillNumber: dto.billNumber !== undefined ? dto.billNumber : entry.billNumber,
      reason: dto.note || 'User edit',
    };

    entry.amount = newAmount;
    if (dto.paymentMode) entry.paymentMode = dto.paymentMode;
    if (dto.billNumber !== undefined) entry.billNumber = dto.billNumber;
    if (dto.customerName !== undefined) entry.customerName = dto.customerName;
    entry.remarks = finalRemarks;
    if (dto.date) entry.date = new Date(dto.date);

    entry.isEdited = true;
    if (!entry.editLogs) entry.editLogs = [];
    entry.editLogs.push(editLog);

    await entry.save();

    return await this.daybookRepo.findById(entry._id.toString(), 'accountId');
  }
}
