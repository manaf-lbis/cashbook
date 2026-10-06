import dayjs from 'dayjs';
import { DailyClosingRepository } from '../repositories/DailyClosingRepository';
import { DailyClosingModel, IDailyClosing, IManualCashSplitUp } from '../models/DailyClosing';
import { DayBookEntryModel } from '../models/DayBookEntry';
import { CreditModel } from '../models/Credit';
import { ExpenseModel } from '../models/Expense';
import { CreditCardTransactionModel } from '../models/CreditCardTransaction';
import { CreditCardModel } from '../models/CreditCard';
import { PayableModel } from '../models/Payable';
import { AccountModel } from '../models/Account';
import { ApiError } from '../utils/ApiError';
import { CreditTransactionType, CreditCardTransactionType } from '../constants/enums';

export interface SaveDailyClosingDTO {
  date: string; // 'YYYY-MM-DD'
  openingBalance: number;
  dayBookSales: number;
  customerNet: number;
  customerRepayments: number;
  customerCreditGiven: number;
  expenseTotal: number;
  creditCardNet: number;
  creditCardDrawn: number;
  creditCardPayment: number;
  manualSplitUps: IManualCashSplitUp[];
  notes?: string;
}

export class DailyClosingService {
  private closingRepo: DailyClosingRepository;

  constructor() {
    this.closingRepo = new DailyClosingRepository();
  }

  /**
   * Fetches real-time computed stats for the given date (default today),
   * along with previous day's closing balance (which serves as today's opening balance),
   * detailed breakdowns of each book, and any existing saved closing record.
   */
  async getLiveDaySummary(dateStr: string) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw ApiError.badRequest('Invalid date format. Expected YYYY-MM-DD');
    }

    const startOfDay = dayjs(dateStr).startOf('day').toDate();
    const endOfDay = dayjs(dateStr).endOf('day').toDate();

    // 1. Check if record already saved for this date
    const existingClosing = await this.closingRepo.findByDate(dateStr);

    // 2. Continuity: find previous closing balance (to automatically set today's opening balance)
    const previousClosing = await this.closingRepo.findPreviousClosing(dateStr);
    const suggestedOpeningBalance = previousClosing ? previousClosing.actualClosingBalance : 0;

    // 3. DAY BOOK: Total sales and biller-wise breakdown for this date
    const dayBookEntries = await DayBookEntryModel.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      isDeleted: { $ne: true },
    }).populate('billerId', 'name role').populate('accountId', 'name');

    const totalDayBookSales = dayBookEntries.reduce((sum, entry) => sum + entry.amount, 0);

    // Group sales by biller
    const billerMap = new Map<string, { billerId: string; billerName: string; totalSales: number; count: number }>();
    for (const entry of dayBookEntries) {
      const biller = entry.billerId as any;
      const bId = biller?._id?.toString() || 'unknown';
      const bName = biller?.name || 'General Biller';
      if (!billerMap.has(bId)) {
        billerMap.set(bId, { billerId: bId, billerName: bName, totalSales: 0, count: 0 });
      }
      const bData = billerMap.get(bId)!;
      bData.totalSales += entry.amount;
      bData.count += 1;
    }
    const billerBreakdown = Array.from(billerMap.values());

    // 4. CUSTOMER BOOK: Today's transactions (repayments received vs credit given)
    const creditsWithEntries = await CreditModel.find({
      'entries.date': { $gte: startOfDay, $lte: endOfDay },
    });

    let customerRepayments = 0; // Customer paid us (Cash in: +)
    let customerCreditGiven = 0; // We gave credit (Credit extended: -)
    const customerTransactions: any[] = [];

    for (const credit of creditsWithEntries) {
      for (const entry of credit.entries) {
        if ((entry as any).isDeleted) continue;
        const eDate = new Date(entry.date);
        if (eDate >= startOfDay && eDate <= endOfDay) {
          if (entry.type === CreditTransactionType.REPAYMENT) {
            customerRepayments += entry.amount;
          } else if (entry.type === CreditTransactionType.GIVEN) {
            customerCreditGiven += entry.amount;
          }
          customerTransactions.push({
            partyName: credit.partyName,
            type: entry.type,
            amount: entry.amount,
            remarks: entry.remarks,
            date: entry.date,
          });
        }
      }
    }
    const customerNet = customerRepayments - customerCreditGiven;

    // 5. EXPENSE BOOK: Total expenses recorded on this date
    const expenses = await ExpenseModel.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      isDeleted: { $ne: true },
    }).populate('accountId', 'name');

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    const expenseCategoryMap = new Map<string, { category: string; total: number; count: number }>();
    for (const exp of expenses) {
      const cat = exp.category || 'General';
      if (!expenseCategoryMap.has(cat)) {
        expenseCategoryMap.set(cat, { category: cat, total: 0, count: 0 });
      }
      const cData = expenseCategoryMap.get(cat)!;
      cData.total += exp.amount;
      cData.count += 1;
    }
    const expenseCategoryBreakdown = Array.from(expenseCategoryMap.values());

    // 6. CREDIT CARDS: Today's card transactions (cash drawn/swipe vs payments)
    const cardTransactions = await CreditCardTransactionModel.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    }).populate('cardId', 'cardName bankName last4Digits');

    let creditCardDrawn = 0; // Cash drawn / swipe (inflow: +)
    let creditCardPayment = 0; // Card bill payment (outflow: -)

    for (const tx of cardTransactions) {
      if (tx.type === CreditCardTransactionType.PURCHASE || tx.type === CreditCardTransactionType.CASH_DRAWN) {
        creditCardDrawn += tx.amount;
      } else if (tx.type === CreditCardTransactionType.PAYMENT) {
        creditCardPayment += tx.amount;
      }
    }
    const creditCardNet = creditCardDrawn - creditCardPayment;

    // 7. Suggested Split-Up Sources:
    // If not saved yet, provide default sources (either from previous day's split-up or active accounts)
    let defaultSplitUps: IManualCashSplitUp[] = [];
    if (existingClosing && existingClosing.manualSplitUps && existingClosing.manualSplitUps.length > 0) {
      defaultSplitUps = existingClosing.manualSplitUps;
    } else if (previousClosing && previousClosing.manualSplitUps && previousClosing.manualSplitUps.length > 0) {
      defaultSplitUps = previousClosing.manualSplitUps.map((s) => ({
        sourceName: s.sourceName,
        amount: 0,
        notes: s.notes,
      }));
    } else {
      const accounts = await AccountModel.find({ isActive: true });
      if (accounts.length > 0) {
        defaultSplitUps = accounts.map((a) => ({
          sourceName: a.name,
          amount: 0,
        }));
      } else {
        defaultSplitUps = [
          { sourceName: 'Cash Drawer / Counter', amount: 0 },
          { sourceName: 'Fedbank', amount: 0 },
          { sourceName: 'SBI', amount: 0 },
          { sourceName: 'CSC Wallet / Digital', amount: 0 },
        ];
      }
    }

    // Opening balance to use: existing closing value or previous day's closing
    const openingBalance = existingClosing
      ? existingClosing.openingBalance
      : suggestedOpeningBalance;

    const expectedClosingBalance =
      openingBalance + totalDayBookSales + customerNet - totalExpenses + creditCardNet;

    return {
      date: dateStr,
      isAlreadyClosed: !!existingClosing,
      existingClosing,
      previousClosing: previousClosing
        ? {
            date: previousClosing.date,
            actualClosingBalance: previousClosing.actualClosingBalance,
            variance: previousClosing.variance,
            status: previousClosing.status,
          }
        : null,
      openingBalance,
      suggestedOpeningBalance,
      dayBook: {
        totalSales: totalDayBookSales,
        totalEntries: dayBookEntries.length,
        billerBreakdown,
        entries: dayBookEntries.slice(0, 50),
      },
      customerBook: {
        customerNet,
        totalRepayments: customerRepayments,
        totalCreditGiven: customerCreditGiven,
        totalTransactions: customerTransactions.length,
        transactions: customerTransactions.slice(0, 50),
      },
      expenseBook: {
        totalExpenses,
        totalEntries: expenses.length,
        categoryBreakdown: expenseCategoryBreakdown,
        expenses: expenses.slice(0, 50),
      },
      creditCardBook: {
        creditCardNet,
        creditCardDrawn,
        creditCardPayment,
        totalTransactions: cardTransactions.length,
        transactions: cardTransactions.slice(0, 50),
      },
      expectedClosingBalance,
      defaultSplitUps,
    };
  }

  /**
   * Saves or updates the daily closing record with enterprise verification,
   * calculating variance and alerting if unbalanced.
   */
  async saveDailyClosing(dto: SaveDailyClosingDTO) {
    const {
      date,
      openingBalance,
      dayBookSales,
      customerNet,
      customerRepayments,
      customerCreditGiven,
      expenseTotal,
      creditCardNet,
      creditCardDrawn,
      creditCardPayment,
      manualSplitUps,
      notes,
    } = dto;

    if (!manualSplitUps || manualSplitUps.length === 0) {
      throw ApiError.badRequest('At least one cash/bank split-up source is required');
    }

    // Formula: LC (Opening) + Daybook + Customer Book - Expenses + Credit Card
    const expectedClosingBalance =
      openingBalance + dayBookSales + customerNet - expenseTotal + creditCardNet;

    // Actual sum of all manually entered cash & bank sources
    const actualClosingBalance = manualSplitUps.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

    // Variance = Actual - Expected
    const variance = actualClosingBalance - expectedClosingBalance;
    const isBalanced = Math.abs(variance) < 0.01;
    const status: 'BALANCED' | 'DISCREPANCY' = isBalanced ? 'BALANCED' : 'DISCREPANCY';

    let warningMessage: string | null = null;
    if (!isBalanced) {
      const diffFormatted = Math.abs(variance).toLocaleString('en-IN');
      if (variance > 0) {
        warningMessage = `⚠️ Discrepancy Warning: Day closing is NOT balanced! You have an excess cash surplus of ₹${diffFormatted}. (Actual ₹${actualClosingBalance.toLocaleString('en-IN')} vs Expected ₹${expectedClosingBalance.toLocaleString('en-IN')}).`;
      } else {
        warningMessage = `⚠️ Discrepancy Warning: Day closing is NOT balanced! You have a cash shortage of ₹${diffFormatted}. (Actual ₹${actualClosingBalance.toLocaleString('en-IN')} vs Expected ₹${expectedClosingBalance.toLocaleString('en-IN')}).`;
      }
    }

    const existing = await this.closingRepo.findByDate(date);
    let closingRecord: IDailyClosing;

    if (existing) {
      // Audit log edit
      const editLogs = existing.editLogs || [];
      if (existing.actualClosingBalance !== actualClosingBalance) {
        editLogs.push({
          editedAt: new Date(),
          previousActual: existing.actualClosingBalance,
          newActual: actualClosingBalance,
          previousVariance: existing.variance,
          newVariance: variance,
          reason: notes || 'Updated closing figures',
        });
      }

      existing.openingBalance = openingBalance;
      existing.dayBookSales = dayBookSales;
      existing.customerNet = customerNet;
      existing.customerRepayments = customerRepayments;
      existing.customerCreditGiven = customerCreditGiven;
      existing.expenseTotal = expenseTotal;
      existing.creditCardNet = creditCardNet;
      existing.creditCardDrawn = creditCardDrawn;
      existing.creditCardPayment = creditCardPayment;
      existing.expectedClosingBalance = expectedClosingBalance;
      existing.manualSplitUps = manualSplitUps;
      existing.actualClosingBalance = actualClosingBalance;
      existing.variance = variance;
      existing.status = status;
      existing.notes = notes;
      existing.closedAt = new Date();
      existing.editLogs = editLogs;

      closingRecord = await existing.save();
    } else {
      closingRecord = await DailyClosingModel.create({
        date,
        openingBalance,
        dayBookSales,
        customerNet,
        customerRepayments,
        customerCreditGiven,
        expenseTotal,
        creditCardNet,
        creditCardDrawn,
        creditCardPayment,
        expectedClosingBalance,
        manualSplitUps,
        actualClosingBalance,
        variance,
        status,
        notes,
        isClosed: true,
        closedAt: new Date(),
      });
    }

    return {
      closing: closingRecord,
      isBalanced,
      variance,
      warningMessage,
    };
  }

  /**
   * Retrieves past daily closing records for audit timeline
   */
  async getHistory(limit = 60) {
    return await this.closingRepo.getClosingHistory(limit);
  }

  /**
   * Generates a comprehensive timeline of all days:
   * - Closed days (Balanced or Discrepancy)
   * - Not closed days (past days with activity where user failed to close)
   * - Opening only days (past days with no activity)
   * - Active open day (today)
   * Rolls forward chronologically from oldest to newest, then presents newest first.
   */
  async getTimelineHistory(daysCount = 14) {
    const todayStr = dayjs().format('YYYY-MM-DD');

    // 1. Current liabilities (Credit cards & supplier payables)
    const cards = await CreditCardModel.find({ isActive: true });
    const totalCardDebt = cards.reduce((sum, c) => sum + (c.totalOutstanding || 0), 0);

    const payables = await PayableModel.find({ status: 'ACTIVE' });
    const totalPayableDebt = payables.reduce((sum, p) => sum + (p.balancePending || 0), 0);

    const totalLiabilities = totalCardDebt + totalPayableDebt;

    // 2. Current live liquid cash from accounts
    const accounts = await AccountModel.find({ isActive: true });
    const currentGrossLiquidCash = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const currentNetLiquidCash = currentGrossLiquidCash - totalLiabilities;

    // 3. Find all saved closings
    const savedClosings = await DailyClosingModel.find().sort({ date: -1 }).limit(365);
    const savedMap = new Map<string, IDailyClosing>();
    for (const c of savedClosings) {
      savedMap.set(c.date, c);
    }

    // 4. Generate dates in chronological order (oldest to newest)
    const dates: string[] = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      dates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
    }

    // 5. Baseline opening balance before dates[0]
    let runningOpening = 0;
    const priorClosing = await DailyClosingModel.findOne({ date: { $lt: dates[0] } }).sort({ date: -1 });
    if (priorClosing) {
      runningOpening = priorClosing.actualClosingBalance;
    } else {
      const firstSaved = savedMap.get(dates[0]);
      if (firstSaved) {
        runningOpening = firstSaved.openingBalance;
      } else {
        const earliestClosing = await DailyClosingModel.findOne().sort({ date: 1 });
        if (earliestClosing && dates[0] >= earliestClosing.date) {
          runningOpening = earliestClosing.actualClosingBalance;
        } else {
          runningOpening = 0;
        }
      }
    }

    const timeline = [];

    // 6. Chronological forward roll
    for (const dateStr of dates) {
      const isToday = dateStr === todayStr;
      const saved = savedMap.get(dateStr);

      if (saved) {
        const isBalanced = saved.status === 'BALANCED' || saved.variance === 0;
        const grossCash = saved.actualClosingBalance;
        const netCash = grossCash - totalCardDebt;

        timeline.push({
          date: dateStr,
          status: isBalanced ? 'CLOSED_BALANCED' : 'CLOSED_DISCREPANCY',
          displayStatus: isBalanced ? 'Closed (Balanced)' : 'Closed (Discrepancy)',
          isSaved: true,
          isToday,
          openingBalance: saved.openingBalance,
          dayBookSales: saved.dayBookSales,
          customerNet: saved.customerNet,
          customerRepayments: saved.customerRepayments || 0,
          customerCreditGiven: saved.customerCreditGiven || 0,
          expenseTotal: saved.expenseTotal,
          creditCardNet: saved.creditCardNet,
          expectedClosingBalance: saved.expectedClosingBalance,
          actualClosingBalance: saved.actualClosingBalance,
          variance: saved.variance,
          grossCashAvailable: grossCash,
          cardLiabilities: totalCardDebt,
          payableLiabilities: totalPayableDebt,
          totalLiabilities,
          netCashBalance: netCash,
          manualSplitUps: saved.manualSplitUps || [],
          notes: saved.notes || '',
          closedAt: saved.closedAt,
        });

        // The actual counted closing balance rolls into the next day's opening
        runningOpening = saved.actualClosingBalance;
      } else {
        // Not saved yet: check ledger activity on that day
        const startOfDay = dayjs(dateStr).startOf('day').toDate();
        const endOfDay = dayjs(dateStr).endOf('day').toDate();

        const [dayBookEntries, credits, expenses, cardTxs] = await Promise.all([
          DayBookEntryModel.find({ date: { $gte: startOfDay, $lte: endOfDay }, isDeleted: { $ne: true } }),
          CreditModel.find({ 'entries.date': { $gte: startOfDay, $lte: endOfDay } }),
          ExpenseModel.find({ date: { $gte: startOfDay, $lte: endOfDay }, isDeleted: { $ne: true } }),
          CreditCardTransactionModel.find({ date: { $gte: startOfDay, $lte: endOfDay } }),
        ]);

        const dayBookSales = dayBookEntries.reduce((s, e) => s + e.amount, 0);
        const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

        let customerRepayments = 0;
        let customerCreditGiven = 0;
        for (const c of credits) {
          for (const e of c.entries) {
            if ((e as any).isDeleted) continue;
            const eD = new Date(e.date);
            if (eD >= startOfDay && eD <= endOfDay) {
              if (e.type === CreditTransactionType.REPAYMENT) customerRepayments += e.amount;
              else if (e.type === CreditTransactionType.GIVEN) customerCreditGiven += e.amount;
            }
          }
        }
        const customerNet = customerRepayments - customerCreditGiven;

        let cardNet = 0;
        for (const t of cardTxs) {
          if (t.type === CreditCardTransactionType.PURCHASE || t.type === CreditCardTransactionType.CASH_DRAWN) {
            cardNet += t.amount;
          } else if (t.type === CreditCardTransactionType.PAYMENT) {
            cardNet -= t.amount;
          }
        }

        const hasActivity = dayBookSales > 0 || expenseTotal > 0 || customerRepayments > 0 || customerCreditGiven > 0 || cardTxs.length > 0;
        const expected = runningOpening + dayBookSales + customerNet - expenseTotal + cardNet;

        let status: 'OPENING' | 'NOT_CLOSED' | 'OPENING_ONLY';
        let displayStatus: string;

        if (isToday) {
          status = 'OPENING';
          displayStatus = 'Opening (Awaiting Close)';
        } else if (hasActivity) {
          status = 'NOT_CLOSED';
          displayStatus = 'Not Closed (Missed)';
        } else {
          status = 'OPENING_ONLY';
          displayStatus = 'Opening Only (No Activity)';
        }

        timeline.push({
          date: dateStr,
          status,
          displayStatus,
          isSaved: false,
          isToday,
          openingBalance: runningOpening,
          dayBookSales,
          customerNet,
          customerRepayments,
          customerCreditGiven,
          expenseTotal,
          creditCardNet: cardNet,
          expectedClosingBalance: expected,
          actualClosingBalance: null,
          variance: null,
          grossCashAvailable: expected,
          cardLiabilities: totalCardDebt,
          payableLiabilities: totalPayableDebt,
          totalLiabilities,
          netCashBalance: expected - totalCardDebt,
          manualSplitUps: [],
          notes: isToday ? 'Active day open' : hasActivity ? 'Closing was missed / not finalized' : 'No entries recorded',
        });

        // For an unclosed day, roll expected cash forward into next day's opening
        runningOpening = expected;
      }
    }

    // 7. Reverse so newest (today) is at the top
    timeline.reverse();

    // 8. Compute Period Audit Metrics
    const closedDays = timeline.filter((t) => t.isSaved && t.status.startsWith('CLOSED'));
    const closedCount = closedDays.length;
    const balancedCount = closedDays.filter((t) => t.status === 'CLOSED_BALANCED' || t.variance === 0).length;
    const discrepancyCount = closedDays.filter((t) => t.status === 'CLOSED_DISCREPANCY' || (t.variance !== null && t.variance !== 0)).length;
    const notClosedCount = timeline.filter((t) => t.status === 'NOT_CLOSED').length;
    const openingCount = timeline.filter((t) => t.status === 'OPENING' || t.status === 'OPENING_ONLY').length;

    const totalPeriodSales = timeline.reduce((sum, t) => sum + (t.dayBookSales || 0), 0);
    const totalPeriodExpenses = timeline.reduce((sum, t) => sum + (t.expenseTotal || 0), 0);
    const totalNetVariance = closedDays.reduce((sum, t) => sum + (t.variance || 0), 0);

    return {
      metrics: {
        totalDays: timeline.length,
        closedCount,
        balancedCount,
        discrepancyCount,
        notClosedCount,
        openingCount,
        totalPeriodSales,
        totalPeriodExpenses,
        totalNetVariance,
        currentGrossCash: currentGrossLiquidCash,
        totalCardDebt,
        totalPayableDebt,
        totalLiabilities,
        currentNetBalance: currentNetLiquidCash,
      },
      timeline,
    };
  }
}
