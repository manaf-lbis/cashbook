import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Building2,
  Receipt,
  UserCheck,
  Clock,
  CreditCard,
  TrendingUp,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  CalendarDays,
  Plus,
} from 'lucide-react';
import { apiClient, formatINR, formatDateTime } from '../../api/client';
import { IDashboardSummary, ApiResponse, TransactionType } from '../../types';
import { useAccounts } from '../../context/AccountContext';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { accounts } = useAccounts();
  const [data, setData] = useState<IDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<ApiResponse<IDashboardSummary>>('/dashboard/summary');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return <LoadingSpinner message="Loading shop overview & ledger data..." />;
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-slate-50">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-2xl shadow-sm max-w-sm w-full">
          <p className="text-slate-600 font-medium">Failed to load dashboard data.</p>
          <Button onClick={fetchDashboard} className="mt-4 w-full" variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const { liquidity, receivables, payables, creditCards, netPosition, categoryExpenses, recentTransactions } = data;
  const bankAccounts = accounts.filter((a) => a.type === 'BANK');

  return (
    <div className="h-full overflow-y-auto bg-slate-50/70">
      <div className="max-w-7xl mx-auto px-6 py-8 sm:px-8 sm:py-10 space-y-7">
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Shop Register
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Financial Overview
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Live balances, counter cash flow, and market credit positions.
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              variant="outline"
              className="bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 shadow-sm font-semibold"
              leftIcon={<Plus className="w-4 h-4 text-emerald-600" />}
              onClick={() => navigate('/daybook')}
            >
              + Record Sale
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              leftIcon={<Receipt className="w-4 h-4 text-rose-500" />}
              onClick={() => navigate('/expenses')}
            >
              + Expense
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              leftIcon={<UserCheck className="w-4 h-4 text-emerald-600" />}
              onClick={() => navigate('/credits')}
            >
              + Give Credit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              leftIcon={<CalendarDays className="w-4 h-4 text-brand-600" />}
              onClick={() => navigate('/daybook')}
            >
              Day Book (Sales)
            </Button>
          </div>
        </div>

        {/* 4 Core Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Liquid Funds */}
          <StatCard
            title="Total Available Cash"
            amount={formatINR(liquidity.totalLiquidity)}
            subtitle={`In Hand: ${formatINR(liquidity.cashInHand)} • Banks: ${formatINR(liquidity.bankBalancesTotal)}`}
            icon={<Wallet className="w-5 h-5" />}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-600"
            onClick={() => navigate('/settings')}
          />

          {/* Card 2: Receivables (Credits Given) */}
          <StatCard
            title="You'll Get (Credits)"
            amount={formatINR(receivables.totalOutstanding)}
            subtitle="Money given out on credit"
            icon={<UserCheck className="w-5 h-5" />}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-600"
            onClick={() => navigate('/credits')}
          />

          {/* Card 3: Payables (Pending Dues) */}
          <StatCard
            title="You'll Give (Payables)"
            amount={formatINR(payables.totalOutstanding)}
            subtitle="Pending dues to suppliers"
            icon={<Clock className="w-5 h-5" />}
            iconBgColor="bg-rose-50"
            iconTextColor="text-rose-600"
            onClick={() => navigate('/payables')}
          />

          {/* Card 4: Credit Cards Debt */}
          <StatCard
            title="Cards Outstanding"
            amount={formatINR(creditCards.totalDebt)}
            subtitle="Credit cards drawn / debt"
            icon={<CreditCard className="w-5 h-5" />}
            iconBgColor="bg-indigo-50"
            iconTextColor="text-indigo-600"
            onClick={() => navigate('/credit-cards')}
          />
        </div>

        {/* Net Business Financial Position Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-800">
                Net Business Liquidity Position
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Formula: Available Cash ({formatINR(liquidity.totalLiquidity)}) + You'll Get ({formatINR(receivables.totalOutstanding)}) - You'll Give ({formatINR(payables.totalOutstanding)}) - Card Debt ({formatINR(creditCards.totalDebt)})
              </p>
            </div>
          </div>
          <div className="text-right sm:text-right">
            <span className="font-mono text-2xl font-bold text-slate-900 tracking-tight">
              {formatINR(netPosition)}
            </span>
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Net Shop Position
            </p>
          </div>
        </div>

        {/* Middle Two-Column Grid: Accounts & Bank Liquidity + Monthly Expenses */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Bank & Cash Balances (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-sky-600" />
                    Accounts & Bank Liquidity
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live balances in shop drawers & bank accounts
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-slate-600 hover:text-slate-900"
                  onClick={() => navigate('/settings')}
                >
                  Manage
                </Button>
              </div>

              <div className="mt-4 space-y-2.5">
                {/* Primary Cash Drawer */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-100/70 text-emerald-700">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Cash Counter Drawer</p>
                      <p className="text-[11px] text-slate-400">Primary Physical Cash</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {formatINR(liquidity.cashInHand)}
                  </span>
                </div>

                {/* Bank Accounts */}
                {bankAccounts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No bank accounts linked yet.</p>
                ) : (
                  bankAccounts.map((acc) => (
                    <div
                      key={acc._id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-sky-100/70 text-sky-700">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{acc.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {acc.bankName || 'Bank'} • ****{acc.accountNumber?.slice(-4) || '—'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {formatINR(acc.balance)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Total Liquid Funds</span>
              <span className="font-mono font-bold text-emerald-600 text-sm">
                {formatINR(liquidity.totalLiquidity)}
              </span>
            </div>
          </div>

          {/* Monthly Expenses Breakdown (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-rose-500" />
                    Monthly Expenses
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Category spending for the current month
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-slate-600 hover:text-slate-900"
                  onClick={() => navigate('/expenses')}
                >
                  View All
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {categoryExpenses.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">No expenses recorded this month.</p>
                ) : (
                  categoryExpenses.map((cat) => {
                    const percentage = data.monthlyExpensesTotal > 0
                      ? Math.round((cat.totalAmount / data.monthlyExpensesTotal) * 100)
                      : 0;

                    return (
                      <div key={cat._id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">{cat._id}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-900">
                              {formatINR(cat.totalAmount)}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">({percentage}%)</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-brand-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Total Spent this Month</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatINR(data.monthlyExpensesTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Full-Width Grid: Recent Journal Transactions (12 cols) */}
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Recent Journal Transactions
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest activity across cash drawer and bank accounts
              </p>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No recent transactions recorded yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Account</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.slice(0, 8).map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {formatDateTime(tx.date)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {tx.accountId?.name || 'Account'}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            tx.type === TransactionType.INFLOW
                              ? 'emerald'
                              : tx.type === TransactionType.OUTFLOW
                              ? 'rose'
                              : 'sky'
                          }
                          size="sm"
                        >
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[280px] truncate">
                        {tx.description}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold ${
                          tx.type === TransactionType.INFLOW
                            ? 'text-emerald-600'
                            : tx.type === TransactionType.OUTFLOW
                            ? 'text-rose-600'
                            : 'text-sky-600'
                        }`}
                      >
                        {tx.type === TransactionType.INFLOW ? '+' : tx.type === TransactionType.OUTFLOW ? '-' : ''}
                        {formatINR(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
