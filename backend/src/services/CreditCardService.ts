import { CreditCardRepository, CreditCardTransactionRepository } from '../repositories/CreditCardRepository';
import { AccountRepository } from '../repositories/AccountRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { CreditCardTransactionType, AccountType, TransactionType, TransactionSource } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { ReconciliationLockService } from './ReconciliationLockService';
import dayjs from 'dayjs';

export class CreditCardService {
  private cardRepo: CreditCardRepository;
  private cardTxRepo: CreditCardTransactionRepository;
  private accountRepo: AccountRepository;
  private transactionRepo: TransactionRepository;

  constructor() {
    this.cardRepo = new CreditCardRepository();
    this.cardTxRepo = new CreditCardTransactionRepository();
    this.accountRepo = new AccountRepository();
    this.transactionRepo = new TransactionRepository();
  }

  async getAllCards() {
    return await this.cardRepo.find({ isActive: true }, { cardName: 1 });
  }

  async getCardById(id: string) {
    const card = await this.cardRepo.findById(id);
    if (!card) throw ApiError.notFound('Credit card not found');
    return card;
  }

  async createCard(dto: {
    cardName: string;
    bankName: string;
    last4Digits: string;
    creditLimit: number;
    billingCycleDate?: number;
    dueDate?: number;
    colorTheme?: string;
  }) {
    if (dto.creditLimit <= 0) throw ApiError.badRequest('Credit limit must be greater than zero');
    return await this.cardRepo.create({
      ...dto,
      totalOutstanding: 0,
      availableLimit: dto.creditLimit,
      isActive: true,
    });
  }

  async updateCard(id: string, data: any) {
    const card = await this.cardRepo.findById(id);
    if (!card) throw ApiError.notFound('Credit card not found');

    if (data.creditLimit !== undefined) {
      data.availableLimit = Math.max(0, data.creditLimit - card.totalOutstanding);
    }

    return await this.cardRepo.update(id, data);
  }

  async deleteCard(id: string) {
    throw ApiError.badRequest('Delete operation is disabled. Only editing entries is permitted.');
  }

  async recordTransaction(dto: {
    cardId: string;
    type?: CreditCardTransactionType;
    amount: number;
    depositToAccountId?: string;
    paidFromAccountId?: string;
    remarks?: string;
    description?: string;
    date?: Date;
  }) {
    if (dto.amount <= 0) throw ApiError.badRequest('Transaction amount must be greater than zero');

    const card = await this.cardRepo.findById(dto.cardId);
    if (!card) throw ApiError.notFound('Credit card not found');

    const txType = dto.type || CreditCardTransactionType.PURCHASE;
    const remarksText = dto.remarks || dto.description || '';
    const txDate = dto.date || new Date();
    const dateStr = dayjs(txDate).format('YYYY-MM-DD');

    let newOutstanding = card.totalOutstanding;

    if (txType === CreditCardTransactionType.CASH_DRAWN || txType === CreditCardTransactionType.PURCHASE) {
      newOutstanding += dto.amount;
      card.totalOutstanding = newOutstanding;
      card.availableLimit = Math.max(0, card.creditLimit - newOutstanding);
      await card.save();

      // If CASH_DRAWN and deposit account is selected, deposit funds into Cash in Hand or Bank
      if (txType === CreditCardTransactionType.CASH_DRAWN && dto.depositToAccountId) {
        const depositAcc = await this.accountRepo.findById(dto.depositToAccountId);
        if (depositAcc) {
          const updatedAcc = await this.accountRepo.adjustBalance(dto.depositToAccountId, dto.amount);

          await this.transactionRepo.create({
            accountId: depositAcc._id,
            type: TransactionType.INFLOW,
            source: TransactionSource.CREDIT_CARD_CASH_DRAWN,
            amount: dto.amount,
            referenceId: card._id,
            description: `Cash drawn from card ${card.cardName} (Ending ${card.last4Digits})${
              remarksText ? ` - ${remarksText}` : ''
            }`,
            balanceAfter: updatedAcc?.balance || 0,
            date: txDate,
          });
        }
      }
    } else if (txType === CreditCardTransactionType.PAYMENT) {
      // Payment reduces outstanding balance
      newOutstanding = Math.max(0, newOutstanding - dto.amount);
      card.totalOutstanding = newOutstanding;
      card.availableLimit = Math.min(card.creditLimit, card.creditLimit - newOutstanding);
      await card.save();

      // If paid from an account (Cash or Bank), deduct funds
      if (dto.paidFromAccountId) {
        const sourceAcc = await this.accountRepo.findById(dto.paidFromAccountId);
        if (sourceAcc) {
          if (sourceAcc.balance < dto.amount) {
            throw ApiError.badRequest(
              `Insufficient funds in ${sourceAcc.name} to pay credit card bill. Available: ₹${sourceAcc.balance}`
            );
          }
          const updatedAcc = await this.accountRepo.adjustBalance(dto.paidFromAccountId, -dto.amount);

          await this.transactionRepo.create({
            accountId: sourceAcc._id,
            type: TransactionType.OUTFLOW,
            source: TransactionSource.CREDIT_CARD_PAYMENT,
            amount: dto.amount,
            referenceId: card._id,
            description: `Payment towards card ${card.cardName} (Ending ${card.last4Digits})${
              remarksText ? ` - ${remarksText}` : ''
            }`,
            balanceAfter: updatedAcc?.balance || 0,
            date: txDate,
          });
        }
      }
    }

    const cardTx = await this.cardTxRepo.create({
      cardId: card._id,
      type: txType,
      amount: dto.amount,
      depositToAccountId: dto.depositToAccountId as any,
      paidFromAccountId: dto.paidFromAccountId as any,
      remarks: remarksText,
      date: txDate,
      balanceAfter: newOutstanding,
    });

    return {
      card,
      transaction: cardTx,
    };
  }

  async getCardTransactions(cardId: string) {
    return await this.cardTxRepo.getTransactionsByCard(cardId);
  }

  async getTotalCardDebt() {
    return await this.cardRepo.getTotalCardDebt();
  }

  async updateTransaction(
    txId: string,
    dto: { amount?: number; remarks?: string; description?: string; date?: Date | string }
  ) {
    const tx = await this.cardTxRepo.findById(txId);
    if (!tx) throw ApiError.notFound('Credit card transaction not found');

    // Block edit if recorded prior to daily closing / reconciliation
    await ReconciliationLockService.assertNotLocked(tx.date, tx.createdAt);
    if (dto.date) {
      await ReconciliationLockService.assertCanCreateEntry(dto.date);
    }

    const card = await this.cardRepo.findById(tx.cardId.toString());
    if (!card) throw ApiError.notFound('Credit card not found');

    const previousAmount = tx.amount;
    const newAmount = dto.amount !== undefined ? dto.amount : previousAmount;
    if (newAmount <= 0) throw ApiError.badRequest('Amount must be greater than zero');

    const delta = newAmount - previousAmount;

    if (delta !== 0) {
      if (tx.type === CreditCardTransactionType.CASH_DRAWN || tx.type === CreditCardTransactionType.PURCHASE) {
        card.totalOutstanding += delta;
        card.availableLimit = Math.max(0, card.creditLimit - card.totalOutstanding);
        if (tx.depositToAccountId) {
          await this.accountRepo.adjustBalance(tx.depositToAccountId.toString(), delta);
        }
      } else if (tx.type === CreditCardTransactionType.PAYMENT) {
        card.totalOutstanding = Math.max(0, card.totalOutstanding - delta);
        card.availableLimit = Math.min(card.creditLimit, card.creditLimit - card.totalOutstanding);
        if (tx.paidFromAccountId) {
          await this.accountRepo.adjustBalance(tx.paidFromAccountId.toString(), -delta);
        }
      }
      await card.save();
    }

    tx.amount = newAmount;
    tx.balanceAfter = card.totalOutstanding;
    if (dto.remarks !== undefined || dto.description !== undefined) {
      tx.remarks = (dto.remarks || dto.description || '').trim();
    }
    if (dto.date) tx.date = new Date(dto.date);

    await tx.save();
    return { card, transaction: tx };
  }
}
