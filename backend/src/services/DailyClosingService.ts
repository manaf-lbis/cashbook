import dayjs from 'dayjs';
import { getStartOfDayIST, getEndOfDayIST, getTodayIST, TIMEZONE } from '../utils/dateUtils';
import { DailyClosingRepository } from '../repositories/DailyClosingRepository';
import { DailyClosingModel, IDailyClosing, IManualCashSplitUp } from '../models/DailyClosing';
import { DayBookEntryModel } from '../models/DayBookEntry';
import { CreditModel } from '../models/Credit';
import { ExpenseModel } from '../models/Expense';
import { CreditCardTransactionModel } from '../models/CreditCardTransaction';
import { CreditCardModel } from '../models/CreditCard';
import { PayableModel } from '../models/Payable';
import { AccountModel } from '../models/Account';
import { BillerModel } from '../models/Biller';
import { ApiError } from '../utils/ApiError';
import { CreditTransactionType, CreditCardTransactionType } from '../constants/enums';

export interface OpenDayDTO {
  date: string;
  openingBalance?: number;
  manualSplitUps: IManualCashSplitUp[];
  notes?: string;
}

export interface SaveDailyClosingDTO {
  date: string; // 'YYYY-MM-DD'
  openingBalance?: number;
  previousClosingCash?: number;
  afterClosingExpenses?: number;
  afterClosingCollections?: number;
  dayBookSales?: number;
  customerNet?: number;
  customerRepayments?: number;
  customerCreditGiven?: number;
  expenseTotal?: number;
  creditCardNet?: number;
  creditCardDrawn?: number;
  creditCardPayment?: number;
  manualSplitUps: IManualCashSplitUp[];
  notes?: string;
}

export type DayActionMode =
  | 'OPEN'
  | 'CLOSE'
  | 'EDIT_CLOSE'
  | 'LOCKED_PAST_CLOSED'
  | 'LOCKED_PAST_MISSED'
  | 'LOCKED_FUTURE';

export class DailyClosingService {
  private closingRepo: DailyClosingRepository;

  constructor() {
    this.closingRepo = new DailyClosingRepository();
  }

  /**
   * Computes rolled-forward cash movements across unclosed gap days
   * between a past closing timestamp and startOfDay of the target date.
   * Runs cleanly via parallel aggregate calls.
   */
  private async computeIntermediateCashDelta(fromDateExclusive: Date, toDateExclusive: Date): Promise<number> {
    if (fromDateExclusive >= toDateExclusive) return 0;

    const [salesAgg, expAgg, cardAgg, creditAgg] = await Promise.all([
      DayBookEntryModel.aggregate([
        { $match: { date: { $gt: fromDateExclusive, $lt: toDateExclusive }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      ExpenseModel.aggregate([
        { $match: { date: { $gt: fromDateExclusive, $lt: toDateExclusive }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CreditCardTransactionModel.aggregate([
        { $match: { date: { $gt: fromDateExclusive, $lt: toDateExclusive } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      CreditModel.aggregate([
        { $unwind: '$entries' },
        { $match: { 'entries.date': { $gt: fromDateExclusive, $lt: toDateExclusive }, 'entries.isDeleted': { $ne: true } } },
        { $group: { _id: '$entries.type', total: { $sum: '$entries.amount' } } },
      ]),
    ]);

    const sales = salesAgg[0]?.total || 0;
    const exp = expAgg[0]?.total || 0;
    let cardNet = 0;
    for (const c of cardAgg) {
      if (c._id === CreditCardTransactionType.PURCHASE || c._id === CreditCardTransactionType.CASH_DRAWN) {
        cardNet += c.total || 0;
      } else if (c._id === CreditCardTransactionType.PAYMENT) {
        cardNet -= c.total || 0;
      }
    }
    let custNet = 0;
    for (const cr of creditAgg) {
      if (cr._id === CreditTransactionType.REPAYMENT) custNet += cr.total || 0;
      else if (cr._id === CreditTransactionType.GIVEN) custNet -= cr.total || 0;
    }

    return sales + custNet - exp + cardNet;
  }

  /**
   * Fetches real-time computed stats for the given date (default today),
   * along with previous day's closing balance, Customer Get vs Give position,
   * the 6 core financial position metrics, and Opening/Closing lifecycle phase.
   */
  async getLiveDaySummary(dateStr: string, options?: { todayOverride?: string }) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw ApiError.badRequest('Invalid date format. Expected YYYY-MM-DD');
    }

    const effectiveToday = options?.todayOverride || getTodayIST();
    const isToday = dateStr === effectiveToday;
    const isPastDate = dateStr < effectiveToday;
    const isFutureDate = dateStr > effectiveToday;

    const startOfDay = getStartOfDayIST(dateStr);
    const endOfDay = getEndOfDayIST(dateStr);
    const yesterdayStr = dayjs.tz(dateStr, TIMEZONE).subtract(1, 'day').format('YYYY-MM-DD');

    // 1. Parallel: find existing day record, most recent CLOSED record, and most recent ANY record
    const [existingClosing, previousClosed, previousAnyRecord] = await Promise.all([
      this.closingRepo.findByDate(dateStr),
      this.closingRepo.findPreviousClosing(dateStr),
      this.closingRepo.findPreviousRecord(dateStr),
    ]);

    // Legacy closing docs created prior to Opening support have isClosed=true and should count as opened
    const isOpened = !!(existingClosing?.isOpened || existingClosing?.isClosed);
    const isClosed = !!existingClosing?.isClosed;

    let actionMode: DayActionMode;
    if (isFutureDate) {
      actionMode = 'LOCKED_FUTURE';
    } else if (isPastDate) {
      actionMode = isClosed ? 'LOCKED_PAST_CLOSED' : 'LOCKED_PAST_MISSED';
    } else {
      // Today (allowed up to 23:59:59 IST)
      if (!isOpened) actionMode = 'OPEN';
      else if (!isClosed) actionMode = 'CLOSE';
      else actionMode = 'EDIT_CLOSE';
    }

    const previousClosingCountedCash = previousClosed ? previousClosed.actualClosingBalance : 0;
    const prevCloseTime = previousClosed
      ? previousClosed.closedAt &&
        dayjs(previousClosed.closedAt).tz(TIMEZONE).format('YYYY-MM-DD') === previousClosed.date
        ? new Date(previousClosed.closedAt)
        : getEndOfDayIST(previousClosed.date)
      : null;

    // 2. Parallel: Execute all ledger queries concurrently with .lean() to minimise server load
    const [
      allDayBookEntries,
      allCredits,
      allPayables,
      activeCards,
      allDayExpenses,
      cardTransactions,
      accounts,
      nightExpenses,
    ] = await Promise.all([
      // Day Book entries today
      DayBookEntryModel.find({
        date: { $gte: startOfDay, $lte: endOfDay },
        isDeleted: { $ne: true },
      })
        .select('billerId accountId amount date remarks billNumber')
        .populate('billerId', 'name role')
        .populate('accountId', 'name')
        .lean(),

      // ALL Customers: computes BOTH overall To Get / To Give AND today's entries in 1 lean pass
      CreditModel.find()
        .select('partyName balanceDue entries')
        .lean(),

      // Active Suppliers (Payables & Receivables)
      PayableModel.find({ status: 'ACTIVE' })
        .select('partyName balancePending')
        .lean(),

      // Active Credit Cards
      CreditCardModel.find({ isActive: true })
        .select('cardName totalOutstanding')
        .lean(),

      // Expenses today
      ExpenseModel.find({
        date: { $gte: startOfDay, $lte: endOfDay },
        isDeleted: { $ne: true },
      })
        .select('title amount category accountId date remarks')
        .populate('accountId', 'name')
        .lean(),

      // Credit Card Transactions today
      CreditCardTransactionModel.find({
        date: { $gte: startOfDay, $lte: endOfDay },
      })
        .populate('cardId', 'cardName bankName last4Digits')
        .lean(),

      // Active Accounts for Cash in Hand / Total Liquid Amount
      AccountModel.find({ isActive: true })
        .select('name type balance')
        .lean(),

      // After-closing night expenses between yesterday's close (when yesterday was closed) and today's start
      prevCloseTime && previousClosed?.date === yesterdayStr
        ? ExpenseModel.find({
            date: { $gt: prevCloseTime, $lt: startOfDay },
            isDeleted: { $ne: true },
          })
            .select('title amount category accountId date remarks')
            .populate('accountId', 'name')
            .lean()
        : Promise.resolve([]),
    ]);

    // 3. Separate After-Closing Collections vs Daytime Day Book Sales
    const taggedAfterCloseCollections = allDayBookEntries.filter(
      (e) => e.remarks && /\[After-Closing Adjustment\]/i.test(e.remarks)
    );
    const dayBookEntries = allDayBookEntries.filter(
      (e) => !e.remarks || !/\[After-Closing Adjustment\]/i.test(e.remarks)
    );

    const totalDayBookSales = dayBookEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
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

    // 4. Customer Book: Overall To Get / To Give AND Today's Cash Movements
    let customerToGet = 0; // Total customers owe us (You'll Get)
    let customerToGive = 0; // Total we owe customers (You'll Give)
    let customerRepayments = 0; // Cash received from customers today (+)
    let customerCreditGiven = 0; // Cash/credit given to customers today (-)
    const customerTransactions: any[] = [];

    for (const credit of allCredits) {
      const due = Number(credit.balanceDue) || 0;
      if (due > 0) customerToGet += due;
      else if (due < 0) customerToGive += Math.abs(due);

      for (const entry of credit.entries || []) {
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

    const customerCollectionNet = customerToGet - customerToGive; // Overall Customer Get - Give
    const customerCashNetToday = customerRepayments - customerCreditGiven; // Today's cash movement

    // 5. Suppliers & Credit Cards Liabilities
    let supplierToPay = 0;
    let supplierToGet = 0;
    for (const p of allPayables) {
      const pending = Number(p.balancePending) || 0;
      if (pending > 0) supplierToPay += pending;
      else if (pending < 0) supplierToGet += Math.abs(pending);
    }
    const totalCardDebt = activeCards.reduce((sum, c) => sum + Math.max(0, Number(c.totalOutstanding) || 0), 0);

    // 6. After-Closing Expenses vs Daytime Expenses
    const taggedAdjustmentExpenses = allDayExpenses.filter(
      (e) => e.remarks && /\[After-Closing Adjustment\]/i.test(e.remarks)
    );
    const afterClosingExpenses = [...nightExpenses, ...taggedAdjustmentExpenses];
    const afterClosingExpenseTotal = afterClosingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const afterClosingCollectionTotal = taggedAfterCloseCollections.reduce((sum, e) => sum + (e.amount || 0), 0);

    const daytimeExpenses = allDayExpenses.filter(
      (e) => !e.remarks || !/\[After-Closing Adjustment\]/i.test(e.remarks)
    );
    const totalExpenses = daytimeExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const expenseCategoryMap = new Map<string, { category: string; total: number; count: number }>();
    for (const exp of daytimeExpenses) {
      const cat = exp.category || 'General';
      if (!expenseCategoryMap.has(cat)) {
        expenseCategoryMap.set(cat, { category: cat, total: 0, count: 0 });
      }
      const cData = expenseCategoryMap.get(cat)!;
      cData.total += exp.amount;
      cData.count += 1;
    }
    const expenseCategoryBreakdown = Array.from(expenseCategoryMap.values());

    // 7. Credit Card Transactions today
    let creditCardDrawn = 0;
    let creditCardPayment = 0;
    for (const tx of cardTransactions) {
      if (tx.type === CreditCardTransactionType.PURCHASE || tx.type === CreditCardTransactionType.CASH_DRAWN) {
        creditCardDrawn += tx.amount;
      } else if (tx.type === CreditCardTransactionType.PAYMENT) {
        creditCardPayment += tx.amount;
      }
    }
    const creditCardNet = creditCardDrawn - creditCardPayment;

    // 8. Account Liquid Breakdown (Cash in Hand & Bank Balances)
    let systemCashInHand = 0;
    let systemBankBalances = 0;
    for (const acc of accounts) {
      if (acc.type === 'CASH') systemCashInHand += acc.balance || 0;
      else systemBankBalances += acc.balance || 0;
    }
    const systemTotalLiquid = systemCashInHand + systemBankBalances;

    // 9. Reconciled Opening Balance Calculation (Strictly Non-Editable once opened or backed by history)
    let missedDaysCarryForward = 0;
    let baseCarryForward = previousClosingCountedCash;

    if (previousClosed && previousClosed.date < yesterdayStr) {
      // One or more days between previousClosed and today were not closed before 11:59 PM.
      // Roll forward net cash movement cleanly so starting balance remains accurate.
      const fromTime = prevCloseTime || getEndOfDayIST(previousClosed.date);
      missedDaysCarryForward = await this.computeIntermediateCashDelta(fromTime, startOfDay);
      baseCarryForward = Math.max(0, previousClosingCountedCash + missedDaysCarryForward);
    } else if (!previousClosed && previousAnyRecord?.isOpened) {
      // No closed day exists yet, but a previous day was opened
      const fromTime = getStartOfDayIST(previousAnyRecord.date);
      missedDaysCarryForward = await this.computeIntermediateCashDelta(fromTime, startOfDay);
      baseCarryForward = Math.max(0, previousAnyRecord.openingBalance + missedDaysCarryForward);
    }

    const reconciledOpeningBalance =
      previousClosed || previousAnyRecord?.isOpened
        ? Math.max(0, baseCarryForward + afterClosingCollectionTotal - afterClosingExpenseTotal)
        : existingClosing
        ? existingClosing.openingBalance
        : systemTotalLiquid;

    // Starting liquid cash is ALWAYS locked once day is opened OR when prior closed/opened records exist
    const isOpeningLocked = isOpened || !!(previousClosed || previousAnyRecord?.isOpened);
    const openingBalance = isOpened && existingClosing ? existingClosing.openingBalance : reconciledOpeningBalance;

    // Expected Liquid Closing Cash: Opening + Sales + Customer Collection (Get - Give) - Expenses + Card Net
    const expectedClosingBalance =
      openingBalance + totalDayBookSales + customerCollectionNet - totalExpenses + creditCardNet;

    // Total Amount We Need to Get & Give across entire ledger
    const amountToGet = customerToGet + supplierToGet;
    const amountToGive = customerToGive + supplierToPay + totalCardDebt;

    // Current reference liquid amount: use saved closed count if closed, else expected/system liquid
    const effectiveLiquidAmount = isClosed && existingClosing
      ? existingClosing.actualClosingBalance
      : expectedClosingBalance;

    // User's exact definitions:
    // 1. Total Cash Available (Liquid Cash) = Old bank accounts + cash drawer everywhere
    // 2. Gross Amount ≈ Total Cash Available
    // 3. Net Amount = Total Cash Available - All Expenses - All Cash We Need to Give
    const grossAmount = effectiveLiquidAmount;
    const netAmount = effectiveLiquidAmount - totalExpenses - amountToGive;

    // 10. Default Split-Up Sources
    let defaultSplitUps: IManualCashSplitUp[] = [];
    if (existingClosing && existingClosing.manualSplitUps && existingClosing.manualSplitUps.length > 0) {
      defaultSplitUps = existingClosing.manualSplitUps;
    } else if (existingClosing && existingClosing.openingManualSplitUps && existingClosing.openingManualSplitUps.length > 0) {
      defaultSplitUps = existingClosing.openingManualSplitUps.map((s) => ({
        sourceName: s.sourceName,
        amount: 0,
        notes: s.notes,
      }));
    } else if (previousClosed && previousClosed.manualSplitUps && previousClosed.manualSplitUps.length > 0) {
      defaultSplitUps = previousClosed.manualSplitUps.map((s) => ({
        sourceName: s.sourceName,
        amount: 0,
        notes: s.notes,
      }));
    } else if (accounts.length > 0) {
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

    return {
      date: dateStr,
      effectiveToday,
      actionMode,
      isOpened,
      isAlreadyClosed: isClosed,
      isOpeningLocked,
      isPastDate,
      existingClosing,
      previousClosing: previousClosed
        ? {
            date: previousClosed.date,
            actualClosingBalance: previousClosed.actualClosingBalance,
            variance: previousClosed.variance,
            status: previousClosed.status,
            closedAt: previousClosed.closedAt,
          }
        : null,
      openingBalance,
      reconciledOpeningBalance,
      previousClosingCountedCash,
      missedDaysCarryForward,
      afterClosingActivity: {
        expenses: afterClosingExpenses,
        totalExpenses: afterClosingExpenseTotal,
        collections: taggedAfterCloseCollections,
        totalCollections: afterClosingCollectionTotal,
        netAdjustment: afterClosingCollectionTotal - afterClosingExpenseTotal,
      },
      dayBook: {
        totalSales: totalDayBookSales,
        totalEntries: dayBookEntries.length,
        billerBreakdown,
        entries: dayBookEntries.slice(0, 50),
      },
      customerBook: {
        customerNet: customerCollectionNet, // Customer Collection (Get - Give)
        totalRepayments: customerRepayments,
        totalCreditGiven: customerCreditGiven,
        customerToGet,
        customerToGive,
        customerCollectionNet, // Overall To Get - To Give
        totalTransactions: customerTransactions.length,
        transactions: customerTransactions.slice(0, 50),
      },
      expenseBook: {
        totalExpenses,
        totalEntries: daytimeExpenses.length,
        categoryBreakdown: expenseCategoryBreakdown,
        expenses: daytimeExpenses.slice(0, 50),
      },
      creditCardBook: {
        creditCardNet,
        creditCardDrawn,
        creditCardPayment,
        totalTransactions: cardTransactions.length,
        transactions: cardTransactions.slice(0, 50),
      },
      // 6 Core Financial Position Fields
      financialPosition: {
        cashInHand: systemCashInHand,
        bankBalance: systemBankBalances,
        systemTotalLiquid,
        totalLiquidAmount: effectiveLiquidAmount,
        amountToGet,
        customerToGet,
        supplierToGet,
        amountToGive,
        customerToGive,
        supplierToPay,
        totalCardDebt,
        grossAmount,
        netAmount,
        // Formula clarity: Opening + (Customer Get - Give)
        openingWithCustomerNet: openingBalance + customerCollectionNet,
      },
      // Daily Milestone & Reconciliation Cycle (Yesterday Close -> Today Opening -> Today Closing)
      milestoneCycle: {
        yesterdayClosing: {
          date: previousClosed?.date || null,
          countedCash: previousClosingCountedCash,
        },
        openingMilestone: {
          isOpened,
          openedAt: existingClosing?.openedAt || null,
          openingBalance,
          openingCountedBalance: existingClosing?.openingCountedBalance ?? openingBalance,
          openingExpectedBalance: existingClosing?.openingExpectedBalance ?? reconciledOpeningBalance,
          variance: existingClosing?.openingVariance ?? 0,
          grossAmount: existingClosing?.openingGrossAmount ?? (existingClosing?.openingCountedBalance ?? openingBalance),
          netAmount:
            existingClosing?.openingNetAmount ??
            (existingClosing?.openingCountedBalance ?? openingBalance) - amountToGive,
          status:
            (existingClosing?.openingVariance ?? 0) === 0 || Math.abs(existingClosing?.openingVariance || 0) < 0.01
              ? ('BALANCED' as const)
              : ('DISCREPANCY' as const),
        },
        closingMilestone: {
          isClosed,
          closedAt: existingClosing?.closedAt || null,
          expectedClosingBalance,
          actualClosingBalance: existingClosing?.actualClosingBalance ?? 0,
          variance: existingClosing?.variance ?? 0,
          grossAmount:
            existingClosing?.closingGrossAmount ?? (existingClosing?.actualClosingBalance ?? grossAmount),
          netAmount:
            existingClosing?.closingNetAmount ??
            ((existingClosing?.actualClosingBalance ?? 0) - totalExpenses - amountToGive),
          status: existingClosing?.status || 'BALANCED',
        },
        cycleComparison: {
          grossGrowth:
            isClosed && existingClosing
              ? (existingClosing.closingGrossAmount || existingClosing.actualClosingBalance) -
                (existingClosing.openingGrossAmount || existingClosing.openingCountedBalance || openingBalance)
              : grossAmount - (existingClosing?.openingGrossAmount || openingBalance),
          netGrowth:
            isClosed && existingClosing
              ? (existingClosing.closingNetAmount || 0) - (existingClosing.openingNetAmount || 0)
              : netAmount - (existingClosing?.openingNetAmount || openingBalance - amountToGive),
          cycleDiscrepancy: isClosed && existingClosing ? existingClosing.variance : 0,
        },
      },
      expectedClosingBalance,
      defaultSplitUps,
    };
  }

  /**
   * Step 1: Open the Day (allowed ONCE per day, strictly view-only forever after).
   * Even at 11:59 PM, the first save of a day is Opening, never Closing.
   */
  async openDay(dto: OpenDayDTO, options?: { todayOverride?: string }) {
    const { date, openingBalance: requestedOpening, manualSplitUps, notes } = dto;
    const effectiveToday = options?.todayOverride || getTodayIST();

    if (date < effectiveToday) {
      throw ApiError.badRequest(
        `Cannot open past day (${date}). Missed days do not require opening/closing; please open today (${effectiveToday}).`
      );
    }
    if (date > effectiveToday) {
      throw ApiError.badRequest(`Cannot open future date (${date}).`);
    }

    const existing = await this.closingRepo.findByDate(date);
    if (existing && (existing.isOpened || existing.isClosed)) {
      throw ApiError.badRequest(
        'This day has already been opened. Day Opening can only happen once and is strictly view-only.'
      );
    }

    if (!manualSplitUps || manualSplitUps.length === 0) {
      throw ApiError.badRequest('At least one cash/bank split-up source is required');
    }

    // Compute authoritative summary before opening
    const liveSummary = await this.getLiveDaySummary(date, options);
    const hasPreviousHistory = !!(liveSummary.previousClosing || liveSummary.missedDaysCarryForward !== 0);
    const openingCountedBalance = manualSplitUps.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

    const authoritativeOpeningBalance = hasPreviousHistory
      ? liveSummary.reconciledOpeningBalance
      : requestedOpening !== undefined && requestedOpening > 0
      ? requestedOpening
      : openingCountedBalance > 0
      ? openingCountedBalance
      : liveSummary.reconciledOpeningBalance;

    const openingExpectedBalance = authoritativeOpeningBalance;
    const openingVariance = openingCountedBalance - openingExpectedBalance;
    const isBalanced = Math.abs(openingVariance) < 0.01;
    const status: 'BALANCED' | 'DISCREPANCY' = isBalanced ? 'BALANCED' : 'DISCREPANCY';

    // Determine counted Cash in Hand from cash split-up rows if present
    const countedCashInHand = manualSplitUps
      .filter((s) => /cash|drawer|counter/i.test(s.sourceName))
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const fp = liveSummary.financialPosition;
    const effectiveCashInHand = countedCashInHand > 0 ? countedCashInHand : fp.cashInHand;

    let warningMessage: string | null = null;
    if (!isBalanced) {
      const diffFormatted = Math.abs(openingVariance).toLocaleString('en-IN');
      warningMessage =
        openingVariance > 0
          ? `Day opened with opening surplus of +₹${diffFormatted} (Counted ₹${openingCountedBalance.toLocaleString('en-IN')} vs Expected ₹${openingExpectedBalance.toLocaleString('en-IN')}).`
          : `Day opened with opening shortage of -₹${diffFormatted} (Counted ₹${openingCountedBalance.toLocaleString('en-IN')} vs Expected ₹${openingExpectedBalance.toLocaleString('en-IN')}).`;
    }

    const record = await DailyClosingModel.create({
      date,
      isOpened: true,
      openedAt: new Date(),
      isClosed: false,
      openingBalance: authoritativeOpeningBalance,
      openingCountedBalance,
      openingExpectedBalance,
      openingVariance,
      openingManualSplitUps: manualSplitUps,
      openingNotes: notes,
      previousClosingCash: liveSummary.previousClosingCountedCash,
      afterClosingExpenses: liveSummary.afterClosingActivity.totalExpenses,
      afterClosingCollections: liveSummary.afterClosingActivity.totalCollections,
      dayBookSales: liveSummary.dayBook.totalSales,
      customerNet: liveSummary.customerBook.customerNet,
      customerRepayments: liveSummary.customerBook.totalRepayments,
      customerCreditGiven: liveSummary.customerBook.totalCreditGiven,
      customerToGet: liveSummary.customerBook.customerToGet,
      customerToGive: liveSummary.customerBook.customerToGive,
      customerCollectionNet: liveSummary.customerBook.customerCollectionNet,
      expenseTotal: liveSummary.expenseBook.totalExpenses,
      creditCardNet: liveSummary.creditCardBook.creditCardNet,
      creditCardDrawn: liveSummary.creditCardBook.creditCardDrawn,
      creditCardPayment: liveSummary.creditCardBook.creditCardPayment,
      expectedClosingBalance: liveSummary.expectedClosingBalance,
      manualSplitUps: [],
      actualClosingBalance: 0,
      variance: 0,
      status,
      cashInHand: effectiveCashInHand,
      totalLiquidAmount: openingCountedBalance,
      amountToGet: fp.amountToGet,
      amountToGive: fp.amountToGive,
      grossAmount: openingCountedBalance,
      netAmount: openingCountedBalance - fp.amountToGive,
      openingGrossAmount: openingCountedBalance,
      openingNetAmount: openingCountedBalance - fp.amountToGive,
    });

    return {
      closing: record,
      isBalanced,
      variance: openingVariance,
      warningMessage,
      actionMode: 'CLOSE' as DayActionMode,
    };
  }

  /**
   * Step 2+: Save or update the daily closing record (2nd calculation and after).
   * Possible ONLY on the same day up to 23:59 IST.
   * Re-closing on the same day records a Same-Day Closing Edit with audit history.
   */
  async saveDailyClosing(dto: SaveDailyClosingDTO, options?: { todayOverride?: string }) {
    const { date, manualSplitUps, notes } = dto;
    const effectiveToday = options?.todayOverride || getTodayIST();

    if (!manualSplitUps || manualSplitUps.length === 0) {
      throw ApiError.badRequest('At least one cash/bank split-up source is required');
    }

    if (date < effectiveToday) {
      throw ApiError.badRequest(
        `Closing cutoff (11:59 PM) has passed for ${date}. Past days cannot be closed later; please start fresh with the new day.`
      );
    }
    if (date > effectiveToday) {
      throw ApiError.badRequest(`Cannot close a future date (${date}).`);
    }

    const existing = await this.closingRepo.findByDate(date);
    if (!existing || (!existing.isOpened && !existing.isClosed)) {
      throw ApiError.badRequest(
        'Please "Open the Day" first before closing it. The first action of any day is always opening.'
      );
    }

    // Recompute authoritative day ledger totals from DB so numbers are 100% tamper-proof
    const liveSummary = await this.getLiveDaySummary(date, options);
    const authoritativeOpeningBalance = existing.openingBalance;
    const dayBookSales = liveSummary.dayBook.totalSales;
    const customerCollectionNet = liveSummary.customerBook.customerCollectionNet;
    const customerRepayments = liveSummary.customerBook.totalRepayments;
    const customerCreditGiven = liveSummary.customerBook.totalCreditGiven;
    const expenseTotal = liveSummary.expenseBook.totalExpenses;
    const creditCardNet = liveSummary.creditCardBook.creditCardNet;
    const creditCardDrawn = liveSummary.creditCardBook.creditCardDrawn;
    const creditCardPayment = liveSummary.creditCardBook.creditCardPayment;

    // Expected Closing Balance incorporates Customer Collection (Get - Give)
    const expectedClosingBalance =
      authoritativeOpeningBalance + dayBookSales + customerCollectionNet - expenseTotal + creditCardNet;

    const actualClosingBalance = manualSplitUps.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

    const variance = actualClosingBalance - expectedClosingBalance;
    const isBalanced = Math.abs(variance) < 0.01;
    const status: 'BALANCED' | 'DISCREPANCY' = isBalanced ? 'BALANCED' : 'DISCREPANCY';

    const fp = liveSummary.financialPosition;
    const countedCashInHand = manualSplitUps
      .filter((s) => /cash|drawer|counter/i.test(s.sourceName))
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const effectiveCashInHand = countedCashInHand > 0 ? countedCashInHand : fp.cashInHand;

    // User's defined pillars:
    // 1. Total Cash Available (Liquid Cash) = actualClosingBalance
    // 2. Gross Amount ≈ Total Cash Available
    // 3. Net Amount = Total Cash Available - All Expenses - All Cash We Need to Give
    const grossAmount = actualClosingBalance;
    const netAmount = actualClosingBalance - expenseTotal - fp.amountToGive;

    let warningMessage: string | null = null;
    if (!isBalanced) {
      const diffFormatted = Math.abs(variance).toLocaleString('en-IN');
      warningMessage =
        variance > 0
          ? `⚠️ Discrepancy Warning: Excess cash surplus of +₹${diffFormatted} (Actual ₹${actualClosingBalance.toLocaleString('en-IN')} vs Expected ₹${expectedClosingBalance.toLocaleString('en-IN')}).`
          : `⚠️ Discrepancy Warning: Cash shortage of -₹${diffFormatted} (Actual ₹${actualClosingBalance.toLocaleString('en-IN')} vs Expected ₹${expectedClosingBalance.toLocaleString('en-IN')}).`;
    }

    const isSameDayEdit = !!existing.isClosed;
    const editLogs = existing.editLogs || [];
    if (isSameDayEdit) {
      editLogs.push({
        editedAt: new Date(),
        previousActual: existing.actualClosingBalance,
        newActual: actualClosingBalance,
        previousVariance: existing.variance,
        newVariance: variance,
        reason: notes || 'Same-day closing edit',
      });
    }

    existing.dayBookSales = dayBookSales;
    existing.customerNet = customerCollectionNet;
    existing.customerRepayments = customerRepayments;
    existing.customerCreditGiven = customerCreditGiven;
    existing.customerToGet = liveSummary.customerBook.customerToGet;
    existing.customerToGive = liveSummary.customerBook.customerToGive;
    existing.customerCollectionNet = customerCollectionNet;
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
    existing.isClosed = true;
    existing.closedAt = new Date();
    existing.cashInHand = effectiveCashInHand;
    existing.totalLiquidAmount = actualClosingBalance;
    existing.amountToGet = fp.amountToGet;
    existing.amountToGive = fp.amountToGive;
    existing.grossAmount = grossAmount;
    existing.netAmount = netAmount;
    existing.closingGrossAmount = grossAmount;
    existing.closingNetAmount = netAmount;
    existing.editLogs = editLogs;

    const closingRecord = await existing.save();

    return {
      closing: closingRecord,
      isBalanced,
      isSameDayEdit,
      variance,
      warningMessage,
      actionMode: 'EDIT_CLOSE' as DayActionMode,
    };
  }

  /**
   * Marks an after-closing expense or collection for reconciling the opening register.
   */
  async markAfterClosingActivity(data: {
    dateStr: string;
    type: 'EXPENSE' | 'COLLECTION';
    title: string;
    amount: number;
    category?: string;
    accountId?: string;
    remarks?: string;
  }) {
    const { dateStr, type, title, amount, category, accountId, remarks } = data;
    if (!amount || amount <= 0) {
      throw ApiError.badRequest('Amount must be positive');
    }

    let targetAccountId = accountId;
    if (!targetAccountId) {
      const cashAcc = await AccountModel.findOne({ name: { $regex: /cash/i }, isActive: true });
      targetAccountId = cashAcc
        ? (cashAcc._id as any).toString()
        : (await AccountModel.findOne({ isActive: true }))?._id?.toString();
    }

    if (!targetAccountId) {
      throw ApiError.badRequest('No active account found for transaction');
    }

    // Set time to early morning 00:01 IST of dateStr
    const adjustmentDate = dayjs.tz(dateStr, TIMEZONE).hour(0).minute(1).second(0).toDate();
    const fullRemarks = `${remarks ? remarks.trim() + ' ' : ''}[After-Closing Adjustment]`;

    if (type === 'EXPENSE') {
      const expense = await ExpenseModel.create({
        title: title.trim(),
        amount,
        category: category?.trim() || 'General',
        accountId: targetAccountId,
        date: adjustmentDate,
        remarks: fullRemarks,
      });

      await AccountModel.findByIdAndUpdate(targetAccountId, { $inc: { balance: -amount } });
      return { success: true, record: expense };
    } else {
      let biller = await BillerModel.findOne({ isActive: true });
      if (!biller) {
        biller = await BillerModel.findOne();
      }
      if (!biller) {
        biller = await BillerModel.create({ name: 'General Staff', role: 'Staff' });
      }

      const entry = await DayBookEntryModel.create({
        billerId: biller._id,
        amount,
        accountId: targetAccountId,
        date: adjustmentDate,
        monthKey: dayjs(adjustmentDate).format('YYYY-MM'),
        remarks: fullRemarks,
        customerName: 'After-Closing Collection',
        paymentMode: 'CASH',
      });
      await AccountModel.findByIdAndUpdate(targetAccountId, { $inc: { balance: amount } });
      return { success: true, record: entry };
    }
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
    const todayStr = getTodayIST();
    const safeDaysCount = Math.min(Math.max(1, Number(daysCount) || 14), 90);
    const dates: string[] = [];
    for (let i = safeDaysCount - 1; i >= 0; i--) {
      dates.push(dayjs().tz(TIMEZONE).subtract(i, 'day').format('YYYY-MM-DD'));
    }

    const minDateStr = dates[0];
    const maxDateStr = dates[dates.length - 1];
    const globalStart = getStartOfDayIST(minDateStr);
    const globalEnd = getEndOfDayIST(maxDateStr);

    // Execute ALL read-only timeline queries in parallel with .lean()
    const [
      cards,
      payables,
      allCredits,
      accounts,
      savedClosings,
      priorClosed,
      earliestClosed,
      dayBookAgg,
      expenseAgg,
      cardAgg,
      creditAgg,
    ] = await Promise.all([
      CreditCardModel.find({ isActive: true }).select('totalOutstanding').lean(),
      PayableModel.find({ status: 'ACTIVE' }).select('balancePending').lean(),
      CreditModel.find().select('balanceDue').lean(),
      AccountModel.find({ isActive: true }).select('balance type').lean(),
      DailyClosingModel.find().sort({ date: -1 }).limit(365).lean(),
      DailyClosingModel.findOne({ date: { $lt: minDateStr }, isClosed: true }).sort({ date: -1 }).lean(),
      DailyClosingModel.findOne({ isClosed: true }).sort({ date: 1 }).lean(),

      DayBookEntryModel.aggregate([
        { $match: { date: { $gte: globalStart, $lte: globalEnd }, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+05:30' } },
            totalSales: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      ExpenseModel.aggregate([
        { $match: { date: { $gte: globalStart, $lte: globalEnd }, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+05:30' } },
            totalExpense: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      CreditCardTransactionModel.aggregate([
        { $match: { date: { $gte: globalStart, $lte: globalEnd } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+05:30' } },
              type: '$type',
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      CreditModel.aggregate([
        { $unwind: '$entries' },
        { $match: { 'entries.date': { $gte: globalStart, $lte: globalEnd }, 'entries.isDeleted': { $ne: true } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$entries.date', timezone: '+05:30' } },
              type: '$entries.type',
            },
            total: { $sum: '$entries.amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalCardDebt = cards.reduce((sum, c) => sum + Math.max(0, c.totalOutstanding || 0), 0);
    const totalPayableDebt = payables.reduce((sum, p) => sum + (p.balancePending > 0 ? p.balancePending : 0), 0);
    const totalCustomerToGet = allCredits.reduce((sum, c) => sum + (c.balanceDue > 0 ? c.balanceDue : 0), 0);
    const totalCustomerToGive = allCredits.reduce((sum, c) => sum + (c.balanceDue < 0 ? Math.abs(c.balanceDue) : 0), 0);
    const totalLiabilities = totalCardDebt + totalPayableDebt + totalCustomerToGive;

    const currentGrossLiquidCash = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const currentNetLiquidCash = currentGrossLiquidCash + totalCustomerToGet - totalLiabilities;

    const savedMap = new Map<string, any>();
    for (const c of savedClosings) {
      savedMap.set(c.date, c);
    }

    const dayBookMap = new Map<string, { totalSales: number; count: number }>();
    for (const r of dayBookAgg) {
      if (r._id) dayBookMap.set(r._id, { totalSales: r.totalSales, count: r.count });
    }

    const expenseMap = new Map<string, { totalExpense: number; count: number }>();
    for (const r of expenseAgg) {
      if (r._id) expenseMap.set(r._id, { totalExpense: r.totalExpense, count: r.count });
    }

    const cardMap = new Map<string, { drawn: number; payment: number; count: number }>();
    for (const r of cardAgg) {
      const d = r._id?.date;
      const type = r._id?.type;
      if (!d) continue;
      if (!cardMap.has(d)) cardMap.set(d, { drawn: 0, payment: 0, count: 0 });
      const item = cardMap.get(d)!;
      if (type === CreditCardTransactionType.PURCHASE || type === CreditCardTransactionType.CASH_DRAWN) {
        item.drawn += r.total;
      } else if (type === CreditCardTransactionType.PAYMENT) {
        item.payment += r.total;
      }
      item.count += r.count;
    }

    const creditMap = new Map<string, { repayments: number; creditGiven: number; count: number }>();
    for (const r of creditAgg) {
      const d = r._id?.date;
      const type = r._id?.type;
      if (!d) continue;
      if (!creditMap.has(d)) creditMap.set(d, { repayments: 0, creditGiven: 0, count: 0 });
      const item = creditMap.get(d)!;
      if (type === CreditTransactionType.REPAYMENT) item.repayments += r.total;
      else if (type === CreditTransactionType.GIVEN) item.creditGiven += r.total;
      item.count += r.count;
    }

    // Baseline opening balance before dates[0]
    let runningOpening = 0;
    if (priorClosed) {
      runningOpening = priorClosed.actualClosingBalance;
    } else {
      const firstSaved = savedMap.get(dates[0]);
      if (firstSaved) {
        runningOpening = firstSaved.openingBalance;
      } else if (earliestClosed && dates[0] >= earliestClosed.date) {
        runningOpening = earliestClosed.actualClosingBalance;
      }
    }

    const timeline = [];

    for (const dateStr of dates) {
      const isToday = dateStr === todayStr;
      const saved = savedMap.get(dateStr);

      if (saved && saved.isClosed) {
        const isBalanced = saved.status === 'BALANCED' || saved.variance === 0;
        const grossCash = saved.actualClosingBalance;
        const netCash = saved.netAmount || grossCash + (saved.amountToGet || 0) - (saved.amountToGive || totalCardDebt);

        timeline.push({
          date: dateStr,
          status: isBalanced ? 'CLOSED_BALANCED' : 'CLOSED_DISCREPANCY',
          displayStatus: isBalanced ? 'Closed (Balanced)' : 'Closed (Discrepancy)',
          isSaved: true,
          isOpened: true,
          isClosed: true,
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
          openedAt: saved.openedAt,
          closedAt: saved.closedAt,
        });

        runningOpening = saved.actualClosingBalance;
      } else {
        const effectiveOpen = saved?.isOpened ? saved.openingBalance : runningOpening;
        const dayBookSales = dayBookMap.get(dateStr)?.totalSales || 0;
        const expenseTotal = expenseMap.get(dateStr)?.totalExpense || 0;
        const cData = creditMap.get(dateStr) || { repayments: 0, creditGiven: 0, count: 0 };
        const customerRepayments = cData.repayments;
        const customerCreditGiven = cData.creditGiven;
        const customerNet = customerRepayments - customerCreditGiven;

        const cardData = cardMap.get(dateStr) || { drawn: 0, payment: 0, count: 0 };
        const cardNet = cardData.drawn - cardData.payment;

        const hasActivity =
          !!saved?.isOpened ||
          dayBookSales > 0 ||
          expenseTotal > 0 ||
          customerRepayments > 0 ||
          customerCreditGiven > 0 ||
          cardData.count > 0;

        const expected = effectiveOpen + dayBookSales + customerNet - expenseTotal + cardNet;

        let status: 'OPENING' | 'NOT_CLOSED' | 'OPENING_ONLY';
        let displayStatus: string;

        if (isToday) {
          status = 'OPENING';
          displayStatus = saved?.isOpened ? 'Opened (Awaiting Close)' : 'Ready to Open';
        } else if (hasActivity) {
          status = 'NOT_CLOSED';
          displayStatus = 'Not Closed (Cutoff Passed)';
        } else {
          status = 'OPENING_ONLY';
          displayStatus = 'No Activity';
        }

        timeline.push({
          date: dateStr,
          status,
          displayStatus,
          isSaved: !!saved?.isOpened,
          isOpened: !!saved?.isOpened,
          isClosed: false,
          isToday,
          openingBalance: effectiveOpen,
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
          netCashBalance: expected + totalCustomerToGet - totalLiabilities,
          manualSplitUps: [],
          notes: isToday
            ? saved?.isOpened
              ? 'Day opened — close before 11:59 PM'
              : 'Ready to Open the Day'
            : hasActivity
            ? 'Not closed by 11:59 PM cutoff'
            : 'No entries recorded',
          openedAt: saved?.openedAt,
        });

        runningOpening = expected;
      }
    }

    timeline.reverse();

    const closedDays = timeline.filter((t) => t.isClosed && t.status.startsWith('CLOSED'));
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
