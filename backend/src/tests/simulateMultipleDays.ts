import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { DailyClosingService } from '../services/DailyClosingService';
import { DailyClosingModel } from '../models/DailyClosing';
import { DayBookEntryModel } from '../models/DayBookEntry';
import { ExpenseModel } from '../models/Expense';
import { CreditModel } from '../models/Credit';
import { AccountModel } from '../models/Account';
import { getStartOfDayIST, getEndOfDayIST, TIMEZONE } from '../utils/dateUtils';
import dayjs from 'dayjs';

async function runSimulation() {
  console.log('====================================================');
  console.log('🚀 STARTING COMPREHENSIVE MULTI-DAY SIMULATION TEST');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shop_cashbook';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  const service = new DailyClosingService();

  // Test dates before any real historical data to test virgin day 1 + rolling forward
  const day1 = '1999-01-01';
  const day2 = '1999-01-02';
  const day3 = '1999-01-03';

  try {
    // 0. Clean any leftover test records for these dates
    console.log('\n--- [Step 0: Initializing Clean Test Environment] ---');
    await DailyClosingModel.deleteMany({ date: { $in: [day1, day2, day3] } });
    await ExpenseModel.deleteMany({
      date: {
        $gte: getStartOfDayIST(day1),
        $lte: getEndOfDayIST(day3),
      },
    });
    await DayBookEntryModel.deleteMany({
      date: {
        $gte: getStartOfDayIST(day1),
        $lte: getEndOfDayIST(day3),
      },
    });
    console.log('✓ Cleaned up any existing records for test dates 2099-01-01 to 2099-01-03');

    // Ensure a default Cash Drawer account and Biller exist
    let cashAccount = await AccountModel.findOne({ name: 'Cash Drawer' });
    if (!cashAccount) {
      cashAccount = await AccountModel.create({
        name: 'Cash Drawer',
        type: 'CASH',
        balance: 10000,
        isActive: true,
      });
    }

    let biller = await mongoose.model('Biller').findOne();
    if (!biller) {
      biller = await mongoose.model('Biller').create({ name: 'Test Biller', role: 'Staff' });
    }

    // =========================================================================
    // SCENARIO 1: DAY 1 OPENING, TRANSACTIONS & CLOSING
    // =========================================================================
    console.log('\n--- [Step 1: Day 1 (1999-01-01) - Opening & Day Operations] ---');
    const day1Summary = await service.getLiveDaySummary(day1);
    console.log(`✓ Day 1 Initial Opening Balance: ₹${day1Summary.openingBalance}`);
    console.log(`✓ Day 1 Is Opening Locked: ${day1Summary.isOpeningLocked} (false expected for first day)`);
    if (day1Summary.isOpeningLocked !== false) {
      throw new Error(`Assertion Failed: Day 1 should not be locked as no previous closing exists.`);
    }

    // Record Day 1 Sales
    const d1SaleDate = dayjs.tz(day1, TIMEZONE).hour(11).minute(30).toDate();
    await DayBookEntryModel.create({
      billerId: biller._id,
      amount: 15000,
      accountId: cashAccount._id,
      date: d1SaleDate,
      monthKey: dayjs(d1SaleDate).format('YYYY-MM'),
      customerName: 'Day 1 Walk-in Customers',
      paymentMode: 'CASH',
    });

    // Record Day 1 Shop Expenses
    const d1ExpDate = dayjs.tz(day1, TIMEZONE).hour(14).minute(0).toDate();
    await ExpenseModel.create({
      title: 'Packaging Materials',
      amount: 3000,
      category: 'Supplies',
      accountId: cashAccount._id,
      date: d1ExpDate,
    });

    // Fetch Day 1 live summary before closing
    const day1Live = await service.getLiveDaySummary(day1);
    console.log(`✓ Day 1 Recorded Sales: ₹${day1Live.dayBook.totalSales} (Expected 15000)`);
    console.log(`✓ Day 1 Recorded Expenses: ₹${day1Live.expenseBook.totalExpenses} (Expected 3000)`);
    console.log(`✓ Day 1 Expected Closing Balance: ₹${day1Live.expectedClosingBalance} (Expected 12000)`);

    if (day1Live.dayBook.totalSales !== 15000) throw new Error('Sales calculation mismatch');
    if (day1Live.expenseBook.totalExpenses !== 3000) throw new Error('Expenses calculation mismatch');

    // Count physical cash at Day 1 close: Cash Drawer = 8,000, Bank = 4,000 -> Total = 12,000
    console.log('\n--- [Step 2: Day 1 Closing Count & Save] ---');
    const day1SaveResult = await service.saveDailyClosing({
      date: day1,
      openingBalance: 0,
      dayBookSales: 15000,
      customerNet: 0,
      customerRepayments: 0,
      customerCreditGiven: 0,
      expenseTotal: 3000,
      creditCardNet: 0,
      creditCardDrawn: 0,
      creditCardPayment: 0,
      manualSplitUps: [
        { sourceName: 'Cash Drawer', amount: 8000 },
        { sourceName: 'Bank Account', amount: 4000 },
      ],
      notes: 'Day 1 closed balanced',
    });

    console.log(`✓ Day 1 Closing Result: Status = ${day1SaveResult.closing.status}, Actual Counted = ₹${day1SaveResult.closing.actualClosingBalance}, Variance = ₹${day1SaveResult.variance}`);
    if (day1SaveResult.closing.actualClosingBalance !== 12000) {
      throw new Error(`Expected Day 1 actual counted closing to be 12000, got ${day1SaveResult.closing.actualClosingBalance}`);
    }
    if (day1SaveResult.isBalanced !== true) {
      throw new Error(`Expected Day 1 to be balanced.`);
    }

    // =========================================================================
    // SCENARIO 2: TAMPERING PREVENTION TEST
    // =========================================================================
    console.log('\n--- [Step 3: Security & Non-Tampering Verification] ---');
    // Try to save Day 2 with spoofed openingBalance: 999999
    const spoofAttempt = await service.saveDailyClosing({
      date: day2,
      openingBalance: 999999, // Attempted tamper!
      dayBookSales: 0,
      customerNet: 0,
      customerRepayments: 0,
      customerCreditGiven: 0,
      expenseTotal: 0,
      creditCardNet: 0,
      creditCardDrawn: 0,
      creditCardPayment: 0,
      manualSplitUps: [{ sourceName: 'Cash Drawer', amount: 12000 }],
    });

    console.log(`✓ Client tried to inject openingBalance = 999999`);
    console.log(`✓ Server enforced authoritative openingBalance = ₹${spoofAttempt.closing.openingBalance}`);
    if (spoofAttempt.closing.openingBalance === 999999) {
      throw new Error('SECURITY VIOLATION: Server allowed client to tamper with starting opening cash!');
    }
    if (spoofAttempt.closing.openingBalance !== 12000) {
      throw new Error(`Server should enforce yesterday closing cash (12000), but got ${spoofAttempt.closing.openingBalance}`);
    }
    console.log('✓ Security verified: Starting liquid cash is authoritatively enforced by server!');
    // Delete temporary record for day 2
    await DailyClosingModel.deleteOne({ date: day2 });

    // =========================================================================
    // SCENARIO 3: AFTER-CLOSING NIGHT EXPENSES & NEXT DAY RECONCILIATION
    // =========================================================================
    console.log('\n--- [Step 4: After-Closing Night Activity Simulation] ---');
    console.log('Marking a late night expense of ₹800 after Day 1 close...');
    const adjResult = await service.markAfterClosingActivity({
      dateStr: day2,
      type: 'EXPENSE',
      title: 'Night Dinner & Travel for Staff',
      amount: 800,
      category: 'Food & Refreshments',
      accountId: cashAccount._id.toString(),
    });

    console.log(`✓ Night adjustment created: ${(adjResult.record as any).title || (adjResult.record as any).customerName}, Amount: ₹${adjResult.record.amount}`);

    // =========================================================================
    // SCENARIO 4: DAY 2 OPENING RECONCILIATION
    // =========================================================================
    console.log('\n--- [Step 5: Day 2 (2099-01-02) Opening Reconciliation] ---');
    const day2Summary = await service.getLiveDaySummary(day2);
    console.log(`✓ Yesterday Counted Closing Cash: ₹${day2Summary.previousClosingCountedCash} (Expected 12000)`);
    console.log(`✓ After-Closing Night Expenses Detected: ₹${day2Summary.afterClosingActivity?.totalExpenses} (Expected 800)`);
    console.log(`✓ Reconciled Starting Opening Cash: ₹${day2Summary.reconciledOpeningBalance} (Expected 11200 = 12000 - 800)`);
    console.log(`✓ Is Starting Cash Locked: ${day2Summary.isOpeningLocked} (Expected true)`);

    if (day2Summary.previousClosingCountedCash !== 12000) {
      throw new Error('Yesterday closing cash mismatch');
    }
    if (day2Summary.afterClosingActivity?.totalExpenses !== 800) {
      throw new Error('Night expense not detected in afterClosingActivity');
    }
    if (day2Summary.reconciledOpeningBalance !== 11200) {
      throw new Error(`Reconciled opening balance mismatch: expected 11200, got ${day2Summary.reconciledOpeningBalance}`);
    }
    if (day2Summary.isOpeningLocked !== true) {
      throw new Error('Day 2 opening cash should be locked!');
    }

    // Verify daytime totalExpenses excludes the after-closing adjustment (no double deduction)
    console.log(`✓ Day 2 Daytime Expenses: ₹${day2Summary.expenseBook.totalExpenses} (Expected 0 since 800 is opening deduction)`);
    if (day2Summary.expenseBook.totalExpenses !== 0) {
      throw new Error('After-closing expense was double-counted into daytime expenses!');
    }

    // =========================================================================
    // SCENARIO 5: DAY 2 OPERATIONS & CLOSING
    // =========================================================================
    console.log('\n--- [Step 6: Day 2 Day Operations & Closing] ---');
    // Day 2 Sales
    const d2SaleDate = dayjs.tz(day2, TIMEZONE).hour(12).minute(0).toDate();
    await DayBookEntryModel.create({
      billerId: biller._id,
      amount: 8000,
      accountId: cashAccount._id,
      date: d2SaleDate,
      monthKey: dayjs(d2SaleDate).format('YYYY-MM'),
      customerName: 'Day 2 Customer',
      paymentMode: 'CASH',
    });

    // Day 2 Daytime Expense
    await ExpenseModel.create({
      title: 'Electricity Bill',
      amount: 1200,
      category: 'Utilities',
      accountId: cashAccount._id,
      date: dayjs.tz(day2, TIMEZONE).hour(15).minute(0).toDate(),
    });

    const day2Live = await service.getLiveDaySummary(day2);
    // Expected = 11,200 (Opening) + 8,000 (Sales) - 1,200 (Day Expense) = 18,000
    console.log(`✓ Day 2 Live Expected Closing: ₹${day2Live.expectedClosingBalance} (Expected 18000)`);
    if (day2Live.expectedClosingBalance !== 18000) {
      throw new Error(`Expected Day 2 closing balance to be 18000, got ${day2Live.expectedClosingBalance}`);
    }

    // Count physical cash: 18,000
    const day2SaveResult = await service.saveDailyClosing({
      date: day2,
      openingBalance: 11200,
      dayBookSales: 8000,
      customerNet: 0,
      customerRepayments: 0,
      customerCreditGiven: 0,
      expenseTotal: 1200,
      creditCardNet: 0,
      creditCardDrawn: 0,
      creditCardPayment: 0,
      manualSplitUps: [
        { sourceName: 'Cash Drawer', amount: 10000 },
        { sourceName: 'Bank Account', amount: 8000 },
      ],
      notes: 'Day 2 closed perfectly balanced',
    });

    console.log(`✓ Day 2 Closing Saved: Actual Counted = ₹${day2SaveResult.closing.actualClosingBalance}, Status = ${day2SaveResult.closing.status}`);
    if (day2SaveResult.isBalanced !== true) {
      throw new Error('Day 2 should be balanced!');
    }

    // =========================================================================
    // SCENARIO 6: DAY 3 CONTINUITY CHECK
    // =========================================================================
    console.log('\n--- [Step 7: Day 3 (2099-01-03) Continuity Roll-Forward] ---');
    const day3Summary = await service.getLiveDaySummary(day3);
    console.log(`✓ Day 3 Opening Cash from Day 2 Counted Close: ₹${day3Summary.openingBalance} (Expected 18000)`);
    console.log(`✓ Day 3 Is Opening Locked: ${day3Summary.isOpeningLocked} (Expected true)`);
    if (day3Summary.openingBalance !== 18000) {
      throw new Error(`Day 3 should start with Day 2 closing cash (18000), got ${day3Summary.openingBalance}`);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL MULTI-DAY SIMULATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('====================================================\n');
  } finally {
    // Clean up test data
    console.log('--- [Cleanup: Purging Test Records] ---');
    await DailyClosingModel.deleteMany({ date: { $in: [day1, day2, day3] } });
    await ExpenseModel.deleteMany({
      date: {
        $gte: getStartOfDayIST(day1),
        $lte: getEndOfDayIST(day3),
      },
    });
    await DayBookEntryModel.deleteMany({
      date: {
        $gte: getStartOfDayIST(day1),
        $lte: getEndOfDayIST(day3),
      },
    });
    console.log('✓ Cleaned up all test records');
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

runSimulation().catch((err) => {
  console.error('\n❌ SIMULATION FAILED:', err);
  process.exit(1);
});
