import { AccountRepository } from '../repositories/AccountRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { AccountType, TransactionType, TransactionSource } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { parseEntryDate, formatDateIST } from '../utils/dateUtils';
import dayjs from 'dayjs';

export class AccountService {
  private accountRepo: AccountRepository;
  private transactionRepo: TransactionRepository;

  constructor() {
    this.accountRepo = new AccountRepository();
    this.transactionRepo = new TransactionRepository();
  }

  async getAllAccounts() {
    return await this.accountRepo.getAllActive();
  }

  async getAccountById(id: string) {
    const account = await this.accountRepo.findById(id);
    if (!account) throw ApiError.notFound('Account not found');
    return account;
  }

  async createAccount(data: {
    name: string;
    type: AccountType;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    balance?: number;
    isDefaultCash?: boolean;
  }) {
    if (data.type === AccountType.CASH && data.isDefaultCash) {
      const existingCash = await this.accountRepo.getCashAccount();
      if (existingCash) {
        throw ApiError.badRequest('Default Cash in Hand account already exists');
      }
    }

    const account = await this.accountRepo.create({
      ...data,
      balance: data.balance || 0,
      isActive: true,
    });

    if (data.balance && data.balance > 0) {
      await this.transactionRepo.create({
        accountId: account._id,
        type: TransactionType.INFLOW,
        amount: data.balance,
        source: TransactionSource.CASHBOOK_ADJUSTMENT,
        description: `Initial balance opening for ${account.name}`,
        balanceAfter: account.balance,
        date: new Date(),
      });
    }

    return account;
  }

  async updateAccount(id: string, data: any) {
    const updated = await this.accountRepo.update(id, data);
    if (!updated) throw ApiError.notFound('Account not found');
    return updated;
  }

  async deleteAccount(id: string) {
    const account = await this.accountRepo.findById(id);
    if (!account) throw ApiError.notFound('Account not found');
    if (account.isDefaultCash || account.type === AccountType.CASH) {
      throw ApiError.badRequest('Default Cash in Hand account cannot be deactivated');
    }
    const updated = await this.accountRepo.update(id, { isActive: false });
    return updated;
  }

  async getLiquiditySummary() {
    const liquidity = await this.accountRepo.getTotalLiquidity();
    const accounts = await this.accountRepo.getAllActive();
    const cashAccount = accounts.find((a) => a.type === AccountType.CASH);
    const bankAccounts = accounts.filter((a) => a.type === AccountType.BANK);

    return {
      cashInHand: cashAccount ? cashAccount.balance : 0,
      cashAccountId: cashAccount ? cashAccount._id : null,
      bankBalancesTotal: liquidity.bankBalancesTotal,
      totalLiquidity: liquidity.totalLiquidity,
      banks: bankAccounts,
    };
  }

  async transferFunds(dto: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    remarks?: string;
    date?: Date;
  }) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw ApiError.badRequest('Source and destination accounts must be different');
    }
    if (dto.amount <= 0) {
      throw ApiError.badRequest('Transfer amount must be greater than zero');
    }

    const fromAcc = await this.accountRepo.findById(dto.fromAccountId);
    if (!fromAcc) throw ApiError.notFound('Source account not found');

    const toAcc = await this.accountRepo.findById(dto.toAccountId);
    if (!toAcc) throw ApiError.notFound('Destination account not found');

    if (fromAcc.balance < dto.amount) {
      throw ApiError.badRequest(`Insufficient funds in ${fromAcc.name}. Current balance: ₹${fromAcc.balance}`);
    }

    const txDate = parseEntryDate(dto.date);
    const dateStr = formatDateIST(txDate);

    // Deduct from source
    const updatedFrom = await this.accountRepo.adjustBalance(dto.fromAccountId, -dto.amount);
    // Add to destination
    const updatedTo = await this.accountRepo.adjustBalance(dto.toAccountId, dto.amount);

    // Record source transaction
    await this.transactionRepo.create({
      accountId: fromAcc._id,
      destinationAccountId: toAcc._id,
      type: TransactionType.TRANSFER,
      amount: dto.amount,
      source: TransactionSource.TRANSFER,
      description: `Transfer to ${toAcc.name}${dto.remarks ? ` (${dto.remarks})` : ''}`,
      balanceAfter: updatedFrom?.balance || 0,
      date: txDate,
    });

    // Record destination transaction
    await this.transactionRepo.create({
      accountId: toAcc._id,
      destinationAccountId: fromAcc._id,
      type: TransactionType.TRANSFER,
      amount: dto.amount,
      source: TransactionSource.TRANSFER,
      description: `Received from ${fromAcc.name}${dto.remarks ? ` (${dto.remarks})` : ''}`,
      balanceAfter: updatedTo?.balance || 0,
      date: txDate,
    });

    return {
      message: 'Transfer completed successfully',
      fromAccount: updatedFrom,
      toAccount: updatedTo,
    };
  }
}
