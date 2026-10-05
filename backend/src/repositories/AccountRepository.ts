import { BaseRepository } from './BaseRepository';
import { AccountModel, IAccount } from '../models/Account';
import { AccountType } from '../constants/enums';
import { ClientSession } from 'mongoose';

export class AccountRepository extends BaseRepository<IAccount> {
  constructor() {
    super(AccountModel);
  }

  async getCashAccount(): Promise<IAccount | null> {
    return await this.findOne({ type: AccountType.CASH, isActive: true });
  }

  async getBankAccounts(): Promise<IAccount[]> {
    return await this.find({ type: AccountType.BANK, isActive: true }, { name: 1 });
  }

  async getAllActive(): Promise<IAccount[]> {
    return await this.find({ isActive: true }, { type: 1, name: 1 });
  }

  async adjustBalance(accountId: string, delta: number, session?: ClientSession): Promise<IAccount | null> {
    const opts: any = { new: true };
    if (session) opts.session = session;
    const res = await this._model.findByIdAndUpdate(
      accountId,
      { $inc: { balance: delta } },
      opts
    ).exec();
    return res as unknown as IAccount | null;
  }

  async getTotalLiquidity(): Promise<{ cashInHand: number; bankBalancesTotal: number; totalLiquidity: number }> {
    const accounts = await this.find({ isActive: true });
    let cashInHand = 0;
    let bankBalancesTotal = 0;

    accounts.forEach((acc) => {
      if (acc.type === AccountType.CASH) {
        cashInHand += acc.balance;
      } else {
        bankBalancesTotal += acc.balance;
      }
    });

    return {
      cashInHand,
      bankBalancesTotal,
      totalLiquidity: cashInHand + bankBalancesTotal,
    };
  }
}
