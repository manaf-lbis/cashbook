import { AccountRepository } from '../repositories/AccountRepository';
import { CreditRepository } from '../repositories/CreditRepository';
import { PayableRepository } from '../repositories/PayableRepository';
import { CreditCardRepository } from '../repositories/CreditCardRepository';
import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { getTodayIST, TIMEZONE } from '../utils/dateUtils';
import dayjs from 'dayjs';

export class DashboardService {
  private accountRepo: AccountRepository;
  private creditRepo: CreditRepository;
  private payableRepo: PayableRepository;
  private cardRepo: CreditCardRepository;
  private expenseRepo: ExpenseRepository;
  private transactionRepo: TransactionRepository;

  constructor() {
    this.accountRepo = new AccountRepository();
    this.creditRepo = new CreditRepository();
    this.payableRepo = new PayableRepository();
    this.cardRepo = new CreditCardRepository();
    this.expenseRepo = new ExpenseRepository();
    this.transactionRepo = new TransactionRepository();
  }

  async getDashboardSummary() {
    const todayStr = getTodayIST();
    const startOfMonth = dayjs().tz(TIMEZONE).startOf('month').toDate();
    const endOfMonth = dayjs().tz(TIMEZONE).endOf('month').toDate();

    const [
      liquidity,
      totalReceivables,
      totalPayables,
      totalCardDebt,
      recentTransactions,
      monthlyExpenses,
      categoryExpenses,
    ] = await Promise.all([
      this.accountRepo.getTotalLiquidity(),
      this.creditRepo.getTotalOutstandingReceivables(),
      this.payableRepo.getTotalOutstandingPayables(),
      this.cardRepo.getTotalCardDebt(),
      this.transactionRepo.getRecent(15),
      this.expenseRepo.getTotalExpenses(startOfMonth, endOfMonth),
      this.expenseRepo.getCategoryBreakdown(startOfMonth, endOfMonth),
    ]);

    const netWorth =
      liquidity.totalLiquidity + totalReceivables - totalPayables - totalCardDebt;

    return {
      liquidity: {
        cashInHand: liquidity.cashInHand,
        bankBalancesTotal: liquidity.bankBalancesTotal,
        totalLiquidity: liquidity.totalLiquidity,
      },
      receivables: {
        totalOutstanding: totalReceivables,
      },
      payables: {
        totalOutstanding: totalPayables,
      },
      creditCards: {
        totalDebt: totalCardDebt,
      },
      netPosition: netWorth,
      todayCashbook: {
        date: todayStr,
      },
      monthlyExpensesTotal: monthlyExpenses,
      categoryExpenses,
      recentTransactions,
    };
  }
}
