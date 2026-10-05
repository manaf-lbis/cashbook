export enum AccountType {
  CASH = 'CASH',
  BANK = 'BANK',
}

export enum TransactionType {
  INFLOW = 'INFLOW',
  OUTFLOW = 'OUTFLOW',
  TRANSFER = 'TRANSFER',
}

export enum TransactionSource {
  CASHBOOK_ADJUSTMENT = 'CASHBOOK_ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  EXPENSE = 'EXPENSE',
  CREDIT_GIVEN = 'CREDIT_GIVEN',
  CREDIT_REPAID = 'CREDIT_REPAID',
  PAYABLE_BORROWED = 'PAYABLE_BORROWED',
  PAYABLE_REPAID = 'PAYABLE_REPAID',
  CREDIT_CARD_CASH_DRAWN = 'CREDIT_CARD_CASH_DRAWN',
  CREDIT_CARD_PAYMENT = 'CREDIT_CARD_PAYMENT',
  DAYBOOK_SALE = 'DAYBOOK_SALE',
  OTHER = 'OTHER',
}

export enum CreditTransactionType {
  GIVEN = 'GIVEN',
  REPAYMENT = 'REPAYMENT',
}

export enum PayableTransactionType {
  BORROWED = 'BORROWED',
  PAID = 'PAID',
}

export enum CreditCardTransactionType {
  PURCHASE = 'PURCHASE',
  CASH_DRAWN = 'CASH_DRAWN',
  PAYMENT = 'PAYMENT',
}

export enum ExpenseCategory {
  RENT = 'Rent',
  SALARY = 'Salary',
  ELECTRICITY = 'Electricity & Bills',
  TEA_SNACKS = 'Tea & Refreshments',
  SUPPLIES = 'Shop Supplies',
  MAINTENANCE = 'Repairs & Maintenance',
  TRANSPORT = 'Transport & Fuel',
  OTHER = 'Other',
}
