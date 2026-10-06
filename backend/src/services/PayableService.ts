import { PayableRepository } from '../repositories/PayableRepository';
import { AccountRepository } from '../repositories/AccountRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { PayableTransactionType, AccountType, TransactionType, TransactionSource } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import dayjs from 'dayjs';

export class PayableService {
  private payableRepo: PayableRepository;
  private accountRepo: AccountRepository;
  private transactionRepo: TransactionRepository;

  constructor() {
    this.payableRepo = new PayableRepository();
    this.accountRepo = new AccountRepository();
    this.transactionRepo = new TransactionRepository();
  }

  async borrowFunds(dto: {
    partyName: string;
    phone?: string;
    amount: number;
    accountId?: string;
    date?: Date;
    remarks?: string;
    dueDate?: Date;
  }) {
    if (dto.amount <= 0) throw ApiError.badRequest('Amount must be greater than zero');

    let account = dto.accountId ? await this.accountRepo.findById(dto.accountId) : null;
    if (!account) {
      account = (await this.accountRepo.getCashAccount()) || (await this.accountRepo.findOne({ isActive: true }));
    }
    if (!account) throw ApiError.notFound('Cash drawer account not found');

    const txDate = dto.date || new Date();
    const dateStr = dayjs(txDate).format('YYYY-MM-DD');

    // 1. Credit into our account (we received money in cash drawer)
    const updatedAccount = await this.accountRepo.adjustBalance(account._id.toString(), dto.amount);

    // 2. Find or create creditor record
    let payable = await this.payableRepo.findOne({
      partyName: { $regex: new RegExp(`^${dto.partyName.trim()}$`, 'i') },
    });

    const newEntry = {
      type: PayableTransactionType.BORROWED,
      amount: dto.amount,
      accountId: account._id,
      date: txDate,
      remarks: dto.remarks,
    };

    if (payable) {
      payable.entries.push(newEntry as any);
      payable.totalBorrowed += dto.amount;
      payable.balancePending += dto.amount;
      payable.status = 'ACTIVE';
      if (dto.phone) payable.phone = dto.phone;
      if (dto.dueDate) payable.dueDate = dto.dueDate;
      await payable.save();
    } else {
      payable = await this.payableRepo.create({
        partyName: dto.partyName.trim(),
        phone: dto.phone,
        totalBorrowed: dto.amount,
        totalPaid: 0,
        balancePending: dto.amount,
        dueDate: dto.dueDate,
        status: 'ACTIVE',
        entries: [newEntry as any],
      });
    }

    // 3. Master Transaction Journal
    await this.transactionRepo.create({
      accountId: account._id,
      type: TransactionType.INFLOW,
      source: TransactionSource.PAYABLE_BORROWED,
      amount: dto.amount,
      referenceId: payable._id,
      description: `Borrowed / Received from ${payable.partyName}${dto.remarks ? ` (${dto.remarks})` : ''}`,
      balanceAfter: updatedAccount?.balance || 0,
      date: txDate,
    });

    return payable;
  }

  async payBackPending(
    payableId: string,
    dto: {
      amount: number;
      accountId?: string;
      date?: Date;
      remarks?: string;
    }
  ) {
    if (dto.amount <= 0) throw ApiError.badRequest('Payment amount must be greater than zero');

    const payable = await this.payableRepo.findById(payableId);
    if (!payable) throw ApiError.notFound('Pending record not found');

    let account = dto.accountId ? await this.accountRepo.findById(dto.accountId) : null;
    if (!account) {
      account = (await this.accountRepo.getCashAccount()) || (await this.accountRepo.findOne({ isActive: true }));
    }
    if (!account) throw ApiError.notFound('Cash drawer account not found');

    if (account.balance < dto.amount) {
      throw ApiError.badRequest(`Insufficient funds in ${account.name}. Available: ₹${account.balance}`);
    }

    const txDate = dto.date || new Date();
    const dateStr = dayjs(txDate).format('YYYY-MM-DD');

    // 1. Deduct from our account (paying them back from cash drawer)
    const updatedAccount = await this.accountRepo.adjustBalance(account._id.toString(), -dto.amount);

    // 2. Update creditor record
    const newEntry = {
      type: PayableTransactionType.PAID,
      amount: dto.amount,
      accountId: account._id,
      date: txDate,
      remarks: dto.remarks,
    };

    payable.entries.push(newEntry as any);
    payable.totalPaid += dto.amount;
    payable.balancePending = Math.max(0, payable.balancePending - dto.amount);
    if (payable.balancePending === 0) {
      payable.status = 'SETTLED';
    }
    await payable.save();

    // 3. Master Transaction Journal
    await this.transactionRepo.create({
      accountId: account._id,
      type: TransactionType.OUTFLOW,
      source: TransactionSource.PAYABLE_REPAID,
      amount: dto.amount,
      referenceId: payable._id,
      description: `Repaid to ${payable.partyName}${dto.remarks ? ` (${dto.remarks})` : ''}`,
      balanceAfter: updatedAccount?.balance || 0,
      date: txDate,
    });

    return payable;
  }

  async getAllPayables(filter: any = {}) {
    return await this.payableRepo.getPayablesWithAccounts(filter);
  }

  async getPayableById(id: string) {
    const payable = await this.payableRepo.findById(id, 'entries.accountId');
    if (!payable) throw ApiError.notFound('Pending record not found');
    return payable;
  }

  async getTotalPayables() {
    return await this.payableRepo.getTotalOutstandingPayables();
  }

  async updatePayableEntry(
    payableId: string,
    entryId: string,
    dto: { amount?: number; remarks?: string; date?: Date | string }
  ) {
    const payable = await this.payableRepo.findById(payableId);
    if (!payable) throw ApiError.notFound('Payable record not found');

    const entry = payable.entries.find(
      (e: any) => e._id?.toString() === entryId || (e as any).id === entryId
    );
    if (!entry) throw ApiError.notFound('Payable entry not found');
    if (entry.isDeleted) throw ApiError.badRequest('Cannot edit a deleted payable entry.');

    const previousAmount = entry.amount;
    const newAmount = dto.amount !== undefined ? dto.amount : previousAmount;
    if (newAmount <= 0) throw ApiError.badRequest('Amount must be greater than zero');

    const delta = newAmount - previousAmount;

    if (delta !== 0) {
      const accountId = entry.accountId ? entry.accountId.toString() : null;
      if (accountId) {
        if (entry.type === PayableTransactionType.BORROWED) {
          // If borrowed amount increases, cash received increases
          await this.accountRepo.adjustBalance(accountId, delta);
          payable.totalBorrowed += delta;
          payable.balancePending += delta;
        } else if (entry.type === PayableTransactionType.PAID) {
          // If paid amount increases, funds deducted from account
          await this.accountRepo.adjustBalance(accountId, -delta);
          payable.totalPaid += delta;
          payable.balancePending = Math.max(0, payable.balancePending - delta);
        }
      }
    }

    payable.status = payable.balancePending <= 0 ? 'SETTLED' : 'ACTIVE';
    entry.amount = newAmount;
    if (dto.remarks !== undefined) entry.remarks = dto.remarks.trim();
    if (dto.date) entry.date = new Date(dto.date);

    await payable.save();
    return await this.payableRepo.findById(payableId, 'entries.accountId');
  }

  async deletePayableEntry(payableId: string, entryId: string) {
    const payable = await this.payableRepo.findById(payableId);
    if (!payable) throw ApiError.notFound('Payable record not found');

    const entry = payable.entries.find(
      (e: any) => e._id?.toString() === entryId || (e as any).id === entryId
    );
    if (!entry) throw ApiError.notFound('Payable entry not found');
    if (entry.isDeleted) throw ApiError.badRequest('Payable entry is already deleted');

    const accountId = entry.accountId ? entry.accountId.toString() : null;
    if (accountId) {
      if (entry.type === PayableTransactionType.BORROWED) {
        await this.accountRepo.adjustBalance(accountId, -entry.amount);
        payable.totalBorrowed = Math.max(0, payable.totalBorrowed - entry.amount);
        payable.balancePending = Math.max(0, payable.balancePending - entry.amount);
      } else if (entry.type === PayableTransactionType.PAID) {
        await this.accountRepo.adjustBalance(accountId, entry.amount);
        payable.totalPaid = Math.max(0, payable.totalPaid - entry.amount);
        payable.balancePending += entry.amount;
      }
    }

    payable.status = payable.balancePending <= 0 ? 'SETTLED' : 'ACTIVE';
    entry.isDeleted = true;
    entry.deletedAt = new Date();

    await payable.save();
    return await this.payableRepo.findById(payableId, 'entries.accountId');
  }
}
