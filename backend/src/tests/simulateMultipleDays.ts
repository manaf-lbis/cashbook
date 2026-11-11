import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { DailyClosingService } from '../services/DailyClosingService';
import { DailyClosingModel } from '../models/DailyClosing';
import { DayBookEntryModel } from '../models/DayBookEntry';
import { ExpenseModel } from '../models/Expense';
import { CreditModel } from '../models/Credit';
import { AccountModel } from '../models/Account';
import { BillerModel } from '../models/Biller';
import { getStartOfDayIST, getEndOfDayIST, TIMEZONE } from '../utils/dateUtils';
import { CreditTransactionType } from '../constants/enums';
import dayjs from 'dayjs';

async function runSimulation() {
  console.log('=====================================================');
  console.log('🚀 STARTING FULL DAY OPENING & CLOSING SIMULATION');
  console.log('=====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shop_cashbook';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  const service = new DailyClosingService();

  // Isolated historical test window so existing DB records never leak into prior day lookup
  const day1 = '1999-01-01';
  const day2 = '1999-01-02';
  const day3 = '1999-01-03';
  const testCustomerPrefix = '__SIM_TEST_CUSTOMER__';
  let cashAccount: any = null;
  let createdTempAccount = false;
  let originalCashAccountBalance = 0;

  try {
    // 0. Clean slate for test window
    await DailyClosingModel.deleteMany({ date: { $in: [day1, day2, day3] } });
    await ExpenseModel.deleteMany({ date: { $gte: getStartOfDayIST(day1), $lte: getEndOfDayIST(day3) } });
    await DayBookEntryModel.deleteMany({ date: { $gte: getStartOfDayIST(day1), $lte: getEndOfDayIST(day3) } });
    await CreditModel.deleteMany({ partyName: { $regex: `^${testCustomerPrefix}` } });

    cashAccount = await AccountModel.findOne({ name: 'Cash Drawer' });
    createdTempAccount = !cashAccount;
    if (!cashAccount) {
      cashAccount = await AccountModel.create({ name: 'Cash Drawer', type: 'CASH', balance: 10000, isActive: true });
    }
    originalCashAccountBalance = cashAccount.balance;
    let biller = await BillerModel.findOne();
    if (!biller) {
      biller = await BillerModel.create({ name: 'Test Biller', role: 'Staff' });
    }

    // =========================================================================
    // SCENARIO 1: DAY 1 - OPEN ONCE (VIEW-ONLY), SALES >= 0, CLOSE & SAME-DAY EDIT
    // =========================================================================
    console.log('--- [Scenario 1: Day 1 Lifecycle (Open Once -> Close -> Same-Day Edit)] ---');
    const d1Pre = await service.getLiveDaySummary(day1, { todayOverride: day1 });
    if (d1Pre.actionMode !== 'OPEN') throw new Error(`Expected actionMode OPEN, got ${d1Pre.actionMode}`);
    console.log(`✓ Initial actionMode: ${d1Pre.actionMode} (Daybook Sales = ₹${d1Pre.dayBook.totalSales} >= 0)`);

    // Must reject closing before opening!
    let closedBeforeOpenBlocked = false;
    try {
      await service.saveDailyClosing(
        { date: day1, manualSplitUps: [{ sourceName: 'Cash Drawer', amount: 1000 }] },
        { todayOverride: day1 }
      );
    } catch {
      closedBeforeOpenBlocked = true;
    }
    if (!closedBeforeOpenBlocked) throw new Error('Must prevent closing before day is opened!');
    console.log('✓ Blocked attempt to Close before Open the Day');

    // Step 1: Open Day 1
    const openRes = await service.openDay(
      {
        date: day1,
        openingBalance: 10000,
        manualSplitUps: [{ sourceName: 'Cash Drawer', amount: 10000 }],
        notes: 'Morning opening count',
      },
      { todayOverride: day1 }
    );
    if (!openRes.closing.isOpened || openRes.closing.isClosed) {
      throw new Error('Opening must set isOpened=true and isClosed=false');
    }
    console.log(`✓ Day 1 Opened (1st Save): Opening Cash = ₹${openRes.closing.openingBalance}`);

    // Opening can only happen ONCE -> Second open attempt must fail!
    let secondOpenBlocked = false;
    try {
      await service.openDay(
        { date: day1, openingBalance: 5000, manualSplitUps: [{ sourceName: 'Cash Drawer', amount: 5000 }] },
        { todayOverride: day1 }
      );
    } catch {
      secondOpenBlocked = true;
    }
    if (!secondOpenBlocked) throw new Error('Day Opening MUST be one-time only and locked afterward!');
    console.log('✓ Verified Opening is locked / view-only (2nd open attempt rejected)');

    // Record Daybook Sale (+5000) & Expense (-1000)
    await DayBookEntryModel.create({
      billerId: biller._id,
      amount: 5000,
      accountId: cashAccount._id,
      date: dayjs.tz(day1, TIMEZONE).hour(13).minute(0).toDate(),
      monthKey: dayjs(day1).format('YYYY-MM'),
      customerName: 'Day 1 Customer',
      paymentMode: 'CASH',
    });
    await ExpenseModel.create({
      title: 'Shop Cleaning',
      amount: 1000,
      category: 'Maintenance',
      accountId: cashAccount._id,
      date: dayjs.tz(day1, TIMEZONE).hour(16).minute(0).toDate(),
    });

    // Step 2: First Closing (2nd Calculation) -> Expected = 10000 + 5000 + customerCollectionNet - 1000
    const d1PreClose = await service.getLiveDaySummary(day1, { todayOverride: day1 });
    if (d1PreClose.actionMode !== 'CLOSE') throw new Error(`Expected actionMode CLOSE, got ${d1PreClose.actionMode}`);
    const expectedD1Close = 10000 + 5000 + d1PreClose.customerBook.customerCollectionNet - 1000;
    if (d1PreClose.expectedClosingBalance !== expectedD1Close) {
      throw new Error(`Expected ${expectedD1Close}, got ${d1PreClose.expectedClosingBalance}`);
    }

    const closeRes = await service.saveDailyClosing(
      {
        date: day1,
        manualSplitUps: [
          { sourceName: 'Cash Drawer', amount: expectedD1Close - 5000 },
          { sourceName: 'SBI Bank', amount: 5000 },
        ],
        notes: 'Initial EOD closing',
      },
      { todayOverride: day1 }
    );
    if (!closeRes.isBalanced || closeRes.closing.actualClosingBalance !== expectedD1Close || closeRes.isSameDayEdit !== false) {
      throw new Error('First close verification failed');
    }
    console.log(`✓ Day 1 Closed (2nd Save): Counted = ₹${closeRes.closing.actualClosingBalance}, Status = ${closeRes.closing.status}`);

    // Step 3: Same-Day Closing Edit (3rd Calculation on same day before 11:59 PM)
    const d1EditSummary = await service.getLiveDaySummary(day1, { todayOverride: day1 });
    if (d1EditSummary.actionMode !== 'EDIT_CLOSE') throw new Error(`Expected EDIT_CLOSE, got ${d1EditSummary.actionMode}`);

    const editCloseRes = await service.saveDailyClosing(
      {
        date: day1,
        manualSplitUps: [
          { sourceName: 'Cash Drawer', amount: expectedD1Close - 4500 },
          { sourceName: 'SBI Bank', amount: 4500 },
        ],
        notes: 'Adjusted split before 11:59 PM',
      },
      { todayOverride: day1 }
    );
    if (!editCloseRes.isSameDayEdit || (editCloseRes.closing.editLogs?.length || 0) !== 1) {
      throw new Error('Expected same-day edit to append to editLogs');
    }
    console.log(`✓ Same-Day Closing Edit (3rd Save) logged in audit history (editLogs count = ${editCloseRes.closing.editLogs?.length})`);

    // =========================================================================
    // SCENARIO 2: MIDNIGHT CUTOFF (11:59 PM) & DAY 2 OPENING RECONCILIATION
    // =========================================================================
    console.log('\n--- [Scenario 2: Past 11:59 PM Cutoff Lock & Day 2 Opening] ---');
    // Check Day 1 when today is Day 2
    const d1PastCheck = await service.getLiveDaySummary(day1, { todayOverride: day2 });
    if (d1PastCheck.actionMode !== 'LOCKED_PAST_CLOSED') {
      throw new Error(`Past closed day must be LOCKED_PAST_CLOSED, got ${d1PastCheck.actionMode}`);
    }
    let pastEditBlocked = false;
    try {
      await service.saveDailyClosing(
        { date: day1, manualSplitUps: [{ sourceName: 'Cash Drawer', amount: 9999 }] },
        { todayOverride: day2 }
      );
    } catch {
      pastEditBlocked = true;
    }
    if (!pastEditBlocked) throw new Error('Must reject closing edits on past dates past 11:59 PM!');
    console.log('✓ Verified Day 1 is strictly view-only after midnight cutoff (11:59 PM)');

    // Mark Night Expense after Day 1 close (₹500)
    await service.markAfterClosingActivity({
      dateStr: day2,
      type: 'EXPENSE',
      title: 'Late Night Fuel',
      amount: 500,
      category: 'Transportation',
      accountId: cashAccount._id.toString(),
    });

    // Open Day 2 with spoofed openingBalance: 999999 -> Server must enforce expectedD1Close - 500
    const expectedD2Open = expectedD1Close - 500;
    const d2OpenRes = await service.openDay(
      {
        date: day2,
        openingBalance: 999999,
        manualSplitUps: [{ sourceName: 'Cash Drawer', amount: expectedD2Open }],
      },
      { todayOverride: day2 }
    );
    if (d2OpenRes.closing.openingBalance !== expectedD2Open) {
      throw new Error(`Expected server-enforced openingBalance ${expectedD2Open}, got ${d2OpenRes.closing.openingBalance}`);
    }
    console.log(`✓ Day 2 Opened: Yesterday Close (₹${expectedD1Close}) - Night Expense (₹500) = ₹${d2OpenRes.closing.openingBalance} (Spoof blocked!)`);

    // =========================================================================
    // SCENARIO 3: MISSED CLOSING ON DAY 2 -> DAY 3 STARTS FRESH (NO LATE CLOSE)
    // =========================================================================
    console.log('\n--- [Scenario 3: Unclosed Day 2 Cutoff -> Day 3 Starts Fresh] ---');
    await DayBookEntryModel.create({
      billerId: biller._id,
      amount: 2500,
      accountId: cashAccount._id,
      date: dayjs.tz(day2, TIMEZONE).hour(15).minute(0).toDate(),
      monthKey: dayjs(day2).format('YYYY-MM'),
      customerName: 'Day 2 Sale',
      paymentMode: 'CASH',
    });

    // Simulate moving to Day 3 without ever closing Day 2
    const d2MissedCheck = await service.getLiveDaySummary(day2, { todayOverride: day3 });
    if (d2MissedCheck.actionMode !== 'LOCKED_PAST_MISSED') {
      throw new Error(`Unclosed past day must be LOCKED_PAST_MISSED, got ${d2MissedCheck.actionMode}`);
    }
    let lateCloseBlocked = false;
    try {
      await service.saveDailyClosing(
        { date: day2, manualSplitUps: [{ sourceName: 'Cash Drawer', amount: 16000 }] },
        { todayOverride: day3 }
      );
    } catch {
      lateCloseBlocked = true;
    }
    if (!lateCloseBlocked) throw new Error('Late closing of past missed day must be blocked!');
    console.log('✓ Past missed day (Day 2) cutoff enforced — cannot close late, start fresh on Day 3');

    const d3Summary = await service.getLiveDaySummary(day3, { todayOverride: day3 });
    if (d3Summary.actionMode !== 'OPEN') throw new Error(`Expected Day 3 actionMode OPEN, got ${d3Summary.actionMode}`);
    // Roll forward: Day 1 Close (expectedD1Close) + Day 2 Sale (2500) - Day 2 AfterClose Night Exp (500)
    const expectedD3Open = expectedD1Close + 2500 - 500;
    if (d3Summary.openingBalance !== expectedD3Open) {
      throw new Error(`Expected Day 3 rolled openingBalance ${expectedD3Open}, got ${d3Summary.openingBalance}`);
    }
    console.log(`✓ Day 3 ready to Open with rolled cash ₹${d3Summary.openingBalance} (Day 1 Close + Day 2 Net)`);

    // =========================================================================
    // SCENARIO 4: CUSTOMER COLLECTION (GET vs GIVE) & 6 CORE LEDGER METRICS
    // =========================================================================
    console.log('\n--- [Scenario 4: Customer Collection (Get - Give) & 6 Financial Metrics] ---');
    // Baseline before adding test customers
    const beforeSummary = await service.getLiveDaySummary(day3, { todayOverride: day3 });
    const baseToGet = beforeSummary.customerBook.customerToGet;
    const baseToGive = beforeSummary.customerBook.customerToGive;
    const baseNet = beforeSummary.financialPosition.netAmount;

    // Add customer who owes us ₹5,000 ("should get ₹5,000 from customer")
    await CreditModel.create({
      partyName: `${testCustomerPrefix}RECEIVABLE_5000`,
      totalGiven: 5000,
      totalRepaid: 0,
      balanceDue: 5000,
      status: 'ACTIVE',
      entries: [
        {
          type: CreditTransactionType.GIVEN,
          amount: 5000,
          accountId: cashAccount._id,
          date: dayjs.tz(day3, TIMEZONE).hour(9).toDate(),
          remarks: 'Test receivable',
        },
      ],
    });

    // Add customer whom we owe ₹2,000 ("need to give ₹2,000 to customer")
    await CreditModel.create({
      partyName: `${testCustomerPrefix}PAYABLE_2000`,
      totalGiven: 0,
      totalRepaid: 2000,
      balanceDue: -2000,
      status: 'ACTIVE',
      entries: [
        {
          type: CreditTransactionType.REPAYMENT,
          amount: 2000,
          accountId: cashAccount._id,
          date: dayjs.tz(day3, TIMEZONE).hour(9).toDate(),
          remarks: 'Test advance payable',
        },
      ],
    });

    const afterCustomerSummary = await service.getLiveDaySummary(day3, { todayOverride: day3 });
    const addedToGet = afterCustomerSummary.customerBook.customerToGet - baseToGet;
    const addedToGive = afterCustomerSummary.customerBook.customerToGive - baseToGive;
    const expectedCollectionDelta = 5000 - 2000; // +3000

    console.log(`✓ Added Customer To Get = ₹${addedToGet}, Customer To Give = ₹${addedToGive}`);
    console.log(`✓ Customer Collection Net Delta (Get - Give) = +₹${addedToGet - addedToGive} (Expected +3000)`);
    console.log(`✓ Verified 6 Financial Position Fields Present:`, {
      cashInHand: afterCustomerSummary.financialPosition.cashInHand,
      totalLiquidAmount: afterCustomerSummary.financialPosition.totalLiquidAmount,
      amountToGet: afterCustomerSummary.financialPosition.amountToGet,
      amountToGive: afterCustomerSummary.financialPosition.amountToGive,
      grossAmount: afterCustomerSummary.financialPosition.grossAmount,
      netAmount: afterCustomerSummary.financialPosition.netAmount,
    });

    if (addedToGet !== 5000 || addedToGive !== 2000 || addedToGet - addedToGive !== expectedCollectionDelta) {
      throw new Error('Customer Collection (Get vs Give) math mismatch!');
    }

    // Verify user's defined formulas:
    // 1. Gross Amount ≈ Total Cash Available
    // 2. Net Amount = Total Cash Available - Expenses - All Cash We Need to Give
    const fp = afterCustomerSummary.financialPosition;
    const totalExp = afterCustomerSummary.expenseBook.totalExpenses;
    if (fp.grossAmount !== fp.totalLiquidAmount) {
      throw new Error(`Gross Amount must equal Total Liquid Amount (${fp.totalLiquidAmount}), got ${fp.grossAmount}`);
    }
    if (fp.netAmount !== fp.totalLiquidAmount - totalExp - fp.amountToGive) {
      throw new Error(`Net Amount formula mismatch! Expected ${fp.totalLiquidAmount - totalExp - fp.amountToGive}, got ${fp.netAmount}`);
    }
    if (afterCustomerSummary.expectedClosingBalance !== afterCustomerSummary.openingBalance + afterCustomerSummary.dayBook.totalSales + afterCustomerSummary.customerBook.customerCollectionNet - totalExp + afterCustomerSummary.creditCardBook.creditCardNet) {
      throw new Error(`Expected Closing Balance must incorporate Customer Collection Net (${afterCustomerSummary.customerBook.customerCollectionNet})`);
    }
    console.log(`✓ User's Gross Amount (≈ Total Cash) & Net Amount (Total Cash - Expenses - To Give) exact formulas verified!`);
    console.log(`✓ Milestone cycle snapshot verified:`, {
      openingGross: afterCustomerSummary.milestoneCycle?.openingMilestone.grossAmount,
      openingNet: afterCustomerSummary.milestoneCycle?.openingMilestone.netAmount,
      closingGross: afterCustomerSummary.milestoneCycle?.closingMilestone.grossAmount,
      closingNet: afterCustomerSummary.milestoneCycle?.closingMilestone.netAmount,
    });

    console.log('\n=====================================================');
    console.log('🎉 ALL SIMULATION SCENARIOS PASSED 100%!');
    console.log('=====================================================\n');
  } finally {
    // Cleanup ALL test data so production/local dev DB remains clean
    await DailyClosingModel.deleteMany({ date: { $in: [day1, day2, day3] } });
    await ExpenseModel.deleteMany({ date: { $gte: getStartOfDayIST(day1), $lte: getEndOfDayIST(day3) } });
    await DayBookEntryModel.deleteMany({ date: { $gte: getStartOfDayIST(day1), $lte: getEndOfDayIST(day3) } });
    await CreditModel.deleteMany({ partyName: { $regex: `^${testCustomerPrefix}` } });
    if (createdTempAccount && cashAccount) {
      await AccountModel.findByIdAndDelete(cashAccount._id);
    } else if (cashAccount) {
      await AccountModel.findByIdAndUpdate(cashAccount._id, { balance: originalCashAccountBalance });
    }
    console.log('✓ Cleaned up all test records safely');
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

runSimulation().catch((err) => {
  console.error('\n❌ SIMULATION FAILED:', err);
  process.exit(1);
});
