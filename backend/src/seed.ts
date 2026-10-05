import mongoose from 'mongoose';
import { connectDB } from './config/db';
import { AccountModel } from './models/Account';
import { ExpenseModel } from './models/Expense';
import { CreditModel } from './models/Credit';
import { PayableModel } from './models/Payable';
import { CreditCardModel } from './models/CreditCard';
import { CreditCardTransactionModel } from './models/CreditCardTransaction';
import { TransactionModel } from './models/Transaction';
import { BillerModel } from './models/Biller';
import { DayBookEntryModel } from './models/DayBookEntry';
import { AccountType, CreditTransactionType, PayableTransactionType, CreditCardTransactionType, TransactionType, TransactionSource } from './constants/enums';
import dayjs from 'dayjs';

const seedDatabase = async () => {
  await connectDB();

  console.log('Clearing existing data for fresh initialization...');
  await AccountModel.deleteMany({});
  await ExpenseModel.deleteMany({});
  await CreditModel.deleteMany({});
  await PayableModel.deleteMany({});
  await CreditCardModel.deleteMany({});
  await CreditCardTransactionModel.deleteMany({});
  await TransactionModel.deleteMany({});

  console.log('Seeding Accounts (Cash in Hand & Bank Balances)...');
  const cashAccount = await AccountModel.create({
    name: 'Cash in Hand (Counter)',
    type: AccountType.CASH,
    balance: 15450,
    isActive: true,
    isDefaultCash: true,
  });

  const hdfcBank = await AccountModel.create({
    name: 'HDFC Current A/c',
    bankName: 'HDFC Bank',
    accountNumber: '50200012345678',
    ifscCode: 'HDFC0001234',
    type: AccountType.BANK,
    balance: 68500,
    isActive: true,
    isDefaultCash: false,
  });

  const sbiBank = await AccountModel.create({
    name: 'SBI Merchant A/c',
    bankName: 'State Bank of India',
    accountNumber: '38291048291',
    ifscCode: 'SBIN0004512',
    type: AccountType.BANK,
    balance: 32000,
    isActive: true,
    isDefaultCash: false,
  });

  console.log('Seeding Credit Cards...');
  const hdfcCard = await CreditCardModel.create({
    cardName: 'HDFC Business Regalia',
    bankName: 'HDFC Bank',
    last4Digits: '8821',
    creditLimit: 150000,
    totalOutstanding: 12500,
    availableLimit: 137500,
    billingCycleDate: 15,
    dueDate: 5,
    colorTheme: 'indigo',
    isActive: true,
  });

  const iciciCard = await CreditCardModel.create({
    cardName: 'ICICI Platinum Commercial',
    bankName: 'ICICI Bank',
    last4Digits: '4190',
    creditLimit: 100000,
    totalOutstanding: 0,
    availableLimit: 100000,
    billingCycleDate: 20,
    dueDate: 10,
    colorTheme: 'amber',
    isActive: true,
  });

  // Credit Card initial swipe transaction
  await CreditCardTransactionModel.create({
    cardId: hdfcCard._id,
    type: CreditCardTransactionType.PURCHASE,
    amount: 12500,
    remarks: 'Store display shelf purchase',
    date: dayjs().subtract(3, 'day').toDate(),
    balanceAfter: 12500,
  });

  console.log('Seeding Credits Book (Given on credit / Receivables)...');
  await CreditModel.create({
    partyName: 'Rajesh Hardware',
    phone: '9876543210',
    totalGiven: 5000,
    totalRepaid: 1500,
    balanceDue: 3500,
    dueDate: dayjs().add(7, 'day').toDate(),
    status: 'ACTIVE',
    entries: [
      {
        type: CreditTransactionType.GIVEN,
        amount: 5000,
        accountId: cashAccount._id,
        date: dayjs().subtract(5, 'day').toDate(),
        remarks: 'Emergency cash borrowed for supply unloading',
      },
      {
        type: CreditTransactionType.REPAYMENT,
        amount: 1500,
        accountId: cashAccount._id,
        date: dayjs().subtract(2, 'day').toDate(),
        remarks: 'Part payment cash received',
      },
    ],
  });

  await CreditModel.create({
    partyName: 'Deepak Electricals',
    phone: '9845112233',
    totalGiven: 2200,
    totalRepaid: 0,
    balanceDue: 2200,
    dueDate: dayjs().add(3, 'day').toDate(),
    status: 'ACTIVE',
    entries: [
      {
        type: CreditTransactionType.GIVEN,
        amount: 2200,
        accountId: hdfcBank._id,
        date: dayjs().subtract(4, 'day').toDate(),
        remarks: 'UPI advance payment',
      },
    ],
  });

  console.log('Seeding Pending Book (Payables / Borrowed from others)...');
  await PayableModel.create({
    partyName: 'Shri Ganesh Wholesale Traders',
    phone: '9988776655',
    totalBorrowed: 15000,
    totalPaid: 5000,
    balancePending: 10000,
    dueDate: dayjs().add(10, 'day').toDate(),
    status: 'ACTIVE',
    entries: [
      {
        type: PayableTransactionType.BORROWED,
        amount: 15000,
        accountId: hdfcBank._id,
        date: dayjs().subtract(10, 'day').toDate(),
        remarks: 'Direct bank transfer goods advance',
      },
      {
        type: PayableTransactionType.PAID,
        amount: 5000,
        accountId: hdfcBank._id,
        date: dayjs().subtract(3, 'day').toDate(),
        remarks: 'NEFT installment paid',
      },
    ],
  });

  console.log('Seeding Expenses...');
  await ExpenseModel.create([
    {
      title: 'Electricity Shop Meter Bill',
      amount: 2450,
      category: 'Electricity & Bills',
      accountId: hdfcBank._id,
      date: dayjs().subtract(1, 'day').toDate(),
      remarks: 'Paid via Netbanking bill desk',
      receiptNumber: 'EB-2026-991',
    },
    {
      title: 'Counter Staff Daily Tea & Snacks',
      amount: 180,
      category: 'Tea & Refreshments',
      accountId: cashAccount._id,
      date: new Date(),
      remarks: 'Morning and evening tea vendor',
    },
    {
      title: 'Shop Packing Tape & Marker Bags',
      amount: 420,
      category: 'Shop Supplies',
      accountId: cashAccount._id,
      date: new Date(),
      remarks: 'Purchased from local market',
    },
  ]);

  console.log('Seeding Billing Persons & Day Book Entries...');
  await BillerModel.deleteMany({});
  await DayBookEntryModel.deleteMany({});

  const biller1 = await BillerModel.create({
    name: 'Rahul (Counter 1)',
    phone: '9876500001',
    role: 'Lead Cashier',
    isActive: true,
    totalSales: 28400,
  });

  const biller2 = await BillerModel.create({
    name: 'Fousiya (Counter 2)',
    phone: '9876500002',
    role: 'Sales Executive',
    isActive: true,
    totalSales: 19800,
  });

  const biller3 = await BillerModel.create({
    name: 'Arun (Store Delivery)',
    phone: '9876500003',
    role: 'Store Counter',
    isActive: true,
    totalSales: 8900,
  });

  const currentMonthKey = dayjs().format('YYYY-MM');
  const prevMonthKey = dayjs().subtract(1, 'month').format('YYYY-MM');

  await DayBookEntryModel.create([
    {
      billerId: biller1._id,
      amount: 14500,
      accountId: cashAccount._id,
      paymentMode: 'CASH',
      date: new Date(),
      monthKey: currentMonthKey,
      billNumber: 'INV-2041',
      customerName: 'Direct Cash Customer',
      remarks: 'Morning sales counter items',
    },
    {
      billerId: biller1._id,
      amount: 13900,
      accountId: hdfcBank._id,
      paymentMode: 'UPI',
      date: new Date(),
      monthKey: currentMonthKey,
      billNumber: 'INV-2042',
      customerName: 'Karthik Rao',
      remarks: 'Electronics accessories sale via UPI',
    },
    {
      billerId: biller2._id,
      amount: 19800,
      accountId: cashAccount._id,
      paymentMode: 'CASH',
      date: new Date(),
      monthKey: currentMonthKey,
      billNumber: 'INV-2043',
      customerName: 'Suresh Hardware',
      remarks: 'Bulk materials retail bill',
    },
    {
      billerId: biller3._id,
      amount: 8900,
      accountId: sbiBank._id,
      paymentMode: 'BANK',
      date: new Date(),
      monthKey: currentMonthKey,
      billNumber: 'INV-2044',
      customerName: 'Walk-in Customer',
      remarks: 'Store counter items',
    },
    // Previous month (August 2026 - View Only)
    {
      billerId: biller1._id,
      amount: 22000,
      accountId: cashAccount._id,
      paymentMode: 'CASH',
      date: dayjs().subtract(1, 'month').toDate(),
      monthKey: prevMonthKey,
      billNumber: 'INV-1090',
      customerName: 'Monthly retail archive',
      remarks: 'August closing batch sales',
    },
  ]);

  console.log('Database seeded successfully! 🎉');
  await mongoose.disconnect();
};

seedDatabase().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
