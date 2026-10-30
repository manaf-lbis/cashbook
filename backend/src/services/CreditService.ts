import { CreditRepository } from '../repositories/CreditRepository';
import { AccountRepository } from '../repositories/AccountRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { CreditTransactionType, AccountType, TransactionType, TransactionSource } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { ReconciliationLockService } from './ReconciliationLockService';
import { parseEntryDate } from '../utils/dateUtils';
import dayjs from 'dayjs';

export class CreditService {
  private creditRepo: CreditRepository;
  private accountRepo: AccountRepository;
  private transactionRepo: TransactionRepository;

  constructor() {
    this.creditRepo = new CreditRepository();
    this.accountRepo = new AccountRepository();
    this.transactionRepo = new TransactionRepository();
  }

  public syncCreditTotals(credit: any) {
    const activeEntries = (credit.entries || []).filter((e: any) => !e.isDeleted);
    const totalGiven = activeEntries
      .filter((e: any) => e.type === CreditTransactionType.GIVEN)
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const totalRepaid = activeEntries
      .filter((e: any) => e.type === CreditTransactionType.REPAYMENT)
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    credit.totalGiven = totalGiven;
    credit.totalRepaid = totalRepaid;
    credit.balanceDue = totalGiven - totalRepaid;
    credit.status = credit.balanceDue === 0 ? 'SETTLED' : 'ACTIVE';
    return credit;
  }

  async createCustomer(dto: {
    partyName: string;
    phone?: string;
    amount?: number;
    accountId?: string;
    date?: Date | string;
    remarks?: string;
    dueDate?: Date | string;
  }) {
    const trimmedName = dto.partyName.trim();
    if (!trimmedName) {
      throw ApiError.badRequest('Party name is required');
    }

    if (dto.amount && dto.amount > 0) {
      return this.giveCredit({
        partyName: trimmedName,
        phone: dto.phone?.trim() || undefined,
        amount: dto.amount,
        accountId: dto.accountId,
        date: dto.date ? parseEntryDate(dto.date) : undefined,
        remarks: dto.remarks?.trim() || 'Opening credit balance',
        dueDate: dto.dueDate ? parseEntryDate(dto.dueDate) : undefined,
      });
    }

    let credit = await this.creditRepo.findOne({
      partyName: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });

    if (credit) {
      if (dto.phone && !credit.phone) {
        credit.phone = dto.phone.trim();
        await credit.save();
      }
      return credit;
    }

    credit = await this.creditRepo.create({
      partyName: trimmedName,
      phone: dto.phone?.trim() || undefined,
      totalGiven: 0,
      totalRepaid: 0,
      balanceDue: 0,
      status: 'ACTIVE',
      entries: [],
      dueDate: dto.dueDate ? parseEntryDate(dto.dueDate) : undefined,
    });

    return credit;
  }

  async giveCredit(dto: {
    partyName: string;
    phone?: string;
    amount: number;
    accountId?: string;
    date?: Date;
    remarks?: string;
    dueDate?: Date;
  }) {
    if (dto.amount <= 0) throw ApiError.badRequest('Credit amount must be greater than zero');

    let account = dto.accountId ? await this.accountRepo.findById(dto.accountId) : null;
    if (!account) {
      account = (await this.accountRepo.getCashAccount()) || (await this.accountRepo.findOne({ isActive: true }));
    }
    if (!account) throw ApiError.notFound('Cash drawer account not found');

    const txDate = parseEntryDate(dto.date);
    await ReconciliationLockService.assertCanCreateEntry(txDate);
    const dateStr = dayjs(txDate).format('YYYY-MM-DD');

    // 1. Deduct from account (cash drawer)
    const updatedAccount = await this.accountRepo.adjustBalance(account._id.toString(), -dto.amount);

    // 2. Find or create party credit record
    let credit = await this.creditRepo.findOne({
      partyName: { $regex: new RegExp(`^${dto.partyName.trim()}$`, 'i') },
    });

    const newEntry = {
      type: CreditTransactionType.GIVEN,
      amount: dto.amount,
      accountId: account._id,
      date: txDate,
      remarks: dto.remarks,
    };

    if (credit) {
      credit.entries.push(newEntry as any);
      if (dto.phone) credit.phone = dto.phone;
      if (dto.dueDate) credit.dueDate = dto.dueDate;
      this.syncCreditTotals(credit);
      await credit.save();
    } else {
      credit = await this.creditRepo.create({
        partyName: dto.partyName.trim(),
        phone: dto.phone,
        totalGiven: dto.amount,
        totalRepaid: 0,
        balanceDue: dto.amount,
        dueDate: dto.dueDate,
        status: 'ACTIVE',
        entries: [newEntry as any],
      });
    }

    // 3. Master Transaction Journal
    await this.transactionRepo.create({
      accountId: account._id,
      type: TransactionType.OUTFLOW,
      amount: dto.amount,
      source: TransactionSource.CREDIT_GIVEN,
      referenceId: credit._id,
      description: `Credit Given to ${credit.partyName}${dto.remarks ? ` (${dto.remarks})` : ''}`,
      balanceAfter: updatedAccount?.balance || 0,
      date: txDate,
    });

    return credit;
  }

  async collectRepayment(
    creditId: string,
    dto: {
      amount: number;
      accountId?: string;
      date?: Date;
      remarks?: string;
    }
  ) {
    if (dto.amount <= 0) throw ApiError.badRequest('Repayment amount must be greater than zero');

    const credit = await this.creditRepo.findById(creditId);
    if (!credit) throw ApiError.notFound('Credit record not found');

    let account = dto.accountId ? await this.accountRepo.findById(dto.accountId) : null;
    if (!account) {
      account = (await this.accountRepo.getCashAccount()) || (await this.accountRepo.findOne({ isActive: true }));
    }
    if (!account) throw ApiError.notFound('Cash drawer account not found');

    const txDate = parseEntryDate(dto.date);
    await ReconciliationLockService.assertCanCreateEntry(txDate);
    const dateStr = dayjs(txDate).format('YYYY-MM-DD');

    // 1. Credit the account (money received into cash drawer)
    const updatedAccount = await this.accountRepo.adjustBalance(account._id.toString(), dto.amount);

    // 2. Update party credit record
    const newEntry = {
      type: CreditTransactionType.REPAYMENT,
      amount: dto.amount,
      accountId: account._id,
      date: txDate,
      remarks: dto.remarks,
    };

    credit.entries.push(newEntry as any);
    this.syncCreditTotals(credit);
    await credit.save();

    // 3. Master Transaction Journal
    await this.transactionRepo.create({
      accountId: account._id,
      type: TransactionType.INFLOW,
      amount: dto.amount,
      source: TransactionSource.CREDIT_REPAID,
      referenceId: credit._id,
      description: `Repayment received from ${credit.partyName}${dto.remarks ? ` (${dto.remarks})` : ''}`,
      balanceAfter: updatedAccount?.balance || 0,
      date: txDate,
    });

    return credit;
  }

  async getAllCredits(filter: any = {}) {
    const credits = await this.creditRepo.getCreditsWithAccounts(filter);
    const allEntries: any[] = [];
    for (const c of credits) {
      if (c.entries) allEntries.push(...c.entries);
    }
    const lockedIds = await ReconciliationLockService.getLockedEntryIds(allEntries);

    return credits.map((c: any) => {
      const activeEntries = (c.entries || []).filter((e: any) => !e.isDeleted);
      const calcGiven = activeEntries
        .filter((e: any) => e.type === CreditTransactionType.GIVEN)
        .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      const calcRepaid = activeEntries
        .filter((e: any) => e.type === CreditTransactionType.REPAYMENT)
        .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      const calcBalance = calcGiven - calcRepaid;
      const calcStatus = calcBalance === 0 ? 'SETTLED' : 'ACTIVE';

      // Self-heal stored document if there was a calculation discrepancy
      if (
        c.totalGiven !== calcGiven ||
        c.totalRepaid !== calcRepaid ||
        c.balanceDue !== calcBalance ||
        c.status !== calcStatus
      ) {
        c.totalGiven = calcGiven;
        c.totalRepaid = calcRepaid;
        c.balanceDue = calcBalance;
        c.status = calcStatus;
        if (typeof c.save === 'function') {
          c.save().catch((err: any) => console.error('Failed to auto-repair credit totals:', err));
        }
      }

      const obj = c.toObject ? c.toObject() : c;
      if (obj.entries) {
        obj.entries = obj.entries.map((e: any) => ({
          ...e,
          isReconciled: lockedIds.has(e._id?.toString()),
        }));
      }
      obj.totalGiven = calcGiven;
      obj.totalRepaid = calcRepaid;
      obj.balanceDue = calcBalance;
      obj.status = calcStatus;
      return obj;
    });
  }

  async getCreditById(id: string) {
    const credit = await this.creditRepo.findById(id, 'entries.accountId');
    if (!credit) throw ApiError.notFound('Credit record not found');
    const lockedIds = await ReconciliationLockService.getLockedEntryIds(credit.entries || []);
    
    this.syncCreditTotals(credit);
    await credit.save().catch((err: any) => console.error('Failed to auto-repair credit totals:', err));

    const obj = (credit as any).toObject ? (credit as any).toObject() : credit;
    if (obj.entries) {
      obj.entries = obj.entries.map((e: any) => ({
        ...e,
        isReconciled: lockedIds.has(e._id?.toString()),
      }));
    }
    obj.totalGiven = credit.totalGiven;
    obj.totalRepaid = credit.totalRepaid;
    obj.balanceDue = credit.balanceDue;
    obj.status = credit.status;
    return obj;
  }

  async getTotalReceivables() {
    return await this.creditRepo.getTotalOutstandingReceivables();
  }

  async updateCreditEntry(
    creditId: string,
    entryId: string,
    dto: { amount?: number; remarks?: string; date?: Date | string }
  ) {
    const credit = await this.creditRepo.findById(creditId);
    if (!credit) throw ApiError.notFound('Credit record not found');

    const entry = credit.entries.find(
      (e: any) => e._id?.toString() === entryId || (e as any).id === entryId
    );
    if (!entry) throw ApiError.notFound('Credit entry not found');
    if (entry.isDeleted) throw ApiError.badRequest('Cannot edit a deleted credit entry.');

    // Block edit if recorded prior to daily closing / reconciliation
    await ReconciliationLockService.assertNotLocked(entry.date, (entry as any).createdAt);
    if (dto.date) {
      await ReconciliationLockService.assertCanCreateEntry(dto.date);
    }

    const previousAmount = entry.amount;
    const newAmount = dto.amount !== undefined ? dto.amount : previousAmount;
    if (newAmount <= 0) throw ApiError.badRequest('Amount must be greater than zero');

    const delta = newAmount - previousAmount;

    if (delta !== 0) {
      const accountId = entry.accountId ? entry.accountId.toString() : null;
      if (accountId) {
        if (entry.type === CreditTransactionType.GIVEN) {
          // If given amount increases, deduct delta from account balance
          await this.accountRepo.adjustBalance(accountId, -delta);
        } else if (entry.type === CreditTransactionType.REPAYMENT) {
          // If repayment increases, add delta to account balance
          await this.accountRepo.adjustBalance(accountId, delta);
        }
      }
    }

    entry.amount = newAmount;
    if (dto.remarks !== undefined) entry.remarks = dto.remarks.trim();
    if (dto.date) entry.date = parseEntryDate(dto.date);

    this.syncCreditTotals(credit);
    await credit.save();
    return await this.creditRepo.findById(creditId, 'entries.accountId');
  }

  async deleteCreditEntry(creditId: string, entryId: string) {
    const credit = await this.creditRepo.findById(creditId);
    if (!credit) throw ApiError.notFound('Credit record not found');

    const entry = credit.entries.find(
      (e: any) => e._id?.toString() === entryId || (e as any).id === entryId
    );
    if (!entry) throw ApiError.notFound('Credit entry not found');
    if (entry.isDeleted) throw ApiError.badRequest('Credit entry is already deleted');

    // Block delete if recorded prior to daily closing / reconciliation
    await ReconciliationLockService.assertNotLocked(entry.date, (entry as any).createdAt);

    const accountId = entry.accountId ? entry.accountId.toString() : null;
    if (accountId) {
      if (entry.type === CreditTransactionType.GIVEN) {
        await this.accountRepo.adjustBalance(accountId, entry.amount);
      } else if (entry.type === CreditTransactionType.REPAYMENT) {
        await this.accountRepo.adjustBalance(accountId, -entry.amount);
      }
    }

    entry.isDeleted = true;
    entry.deletedAt = new Date();

    this.syncCreditTotals(credit);
    await credit.save();
    return await this.creditRepo.findById(creditId, 'entries.accountId');
  }
}
