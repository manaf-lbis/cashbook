import mongoose from 'mongoose';
import { connectDB } from './config/db';
import { AccountModel } from './models/Account';
import { ExpenseModel } from './models/Expense';
import { ExpenseCategoryModel } from './models/ExpenseCategory';
import { CreditModel } from './models/Credit';
import { PayableModel } from './models/Payable';
import { CreditCardModel } from './models/CreditCard';
import { CreditCardTransactionModel } from './models/CreditCardTransaction';
import { TransactionModel } from './models/Transaction';
import { BillerModel } from './models/Biller';
import { DayBookEntryModel } from './models/DayBookEntry';
import { DailyClosingModel } from './models/DailyClosing';
import { AccountType } from './constants/enums';

const clearAllData = async () => {
  try {
    await connectDB();
    console.log('--- Clearing All Dummy Data ---');

    // 1. Delete all transactional entries
    const delSales = await DayBookEntryModel.deleteMany({});
    console.log(`Deleted ${delSales.deletedCount} DayBook sales entries.`);

    const delExpenses = await ExpenseModel.deleteMany({});
    console.log(`Deleted ${delExpenses.deletedCount} Expense entries.`);

    const delCredits = await CreditModel.deleteMany({});
    console.log(`Deleted ${delCredits.deletedCount} Customer credit records.`);

    const delPayables = await PayableModel.deleteMany({});
    console.log(`Deleted ${delPayables.deletedCount} Supplier payable records.`);

    const delCardTxs = await CreditCardTransactionModel.deleteMany({});
    console.log(`Deleted ${delCardTxs.deletedCount} Credit Card transactions.`);

    const delCards = await CreditCardModel.deleteMany({});
    console.log(`Deleted ${delCards.deletedCount} Credit Cards.`);

    const delTxs = await TransactionModel.deleteMany({});
    console.log(`Deleted ${delTxs.deletedCount} Audit journal transactions.`);

    const delClosings = await DailyClosingModel.deleteMany({});
    console.log(`Deleted ${delClosings.deletedCount} Daily Closing reconciliations.`);

    // 2. Reset Expense Categories
    await ExpenseCategoryModel.deleteMany({});
    await ExpenseCategoryModel.insertMany([
      { name: 'Shop Expenses', totalSpent: 0, count: 0 },
      { name: 'Courier Expense', totalSpent: 0, count: 0 },
      { name: 'Salary & Staff', totalSpent: 0, count: 0 },
      { name: 'Tea & Refreshments', totalSpent: 0, count: 0 },
      { name: 'Repairs & Maintenance', totalSpent: 0, count: 0 },
    ]);
    console.log('Reset Expense Categories to zero spent.');

    // 3. Reset Billers
    await BillerModel.deleteMany({});
    await BillerModel.create({
      name: 'Main Counter',
      role: 'Cashier / Billing Counter',
      totalSales: 0,
      isActive: true,
    });
    console.log('Created clean starting biller "Main Counter".');

    // 4. Reset Accounts to 0
    await AccountModel.deleteMany({});
    await AccountModel.create({
      name: 'Cash in Hand (Counter)',
      type: AccountType.CASH,
      balance: 0,
      isActive: true,
      isDefaultCash: true,
    });
    await AccountModel.create({
      name: 'Bank Current A/c',
      bankName: 'Bank',
      accountNumber: '1234567890',
      type: AccountType.BANK,
      balance: 0,
      isActive: true,
      isDefaultCash: false,
    });
    console.log('Reset Cash & Bank accounts to zero balances.');

    console.log('--- Successfully Cleared All Data! Ready for fresh testing ---');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  }
};

clearAllData();
