import React, { useState } from 'react';
import { Settings, Plus, Building2, Wallet, Trash2, CheckCircle2, Shield } from 'lucide-react';
import { useAccounts } from '../../context/AccountContext';
import { formatINR } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AddAccountModal } from './components/AddAccountModal';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export const SettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const { accounts, refreshAccounts, liquidity } = useAccounts();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleDelete = async (id: string, name: string, isDefaultCash: boolean) => {
    if (isDefaultCash) {
      showToast('Cannot delete default Cash in Hand account', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to deactivate account "${name}"?`)) return;

    try {
      await apiClient.delete(`/accounts/${id}`);
      showToast('Account deactivated successfully', 'success');
      refreshAccounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-slate-700" />
            Accounts & System Master
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your shop's cash drawers, bank accounts, and master ledger configuration.
          </p>
        </div>

        <Button
          size="md"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddOpen(true)}
        >
          Add Bank / Cash Account
        </Button>
      </div>

      {/* Account Master List */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Active Accounts</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Total Liquid Funds across accounts: <span className="font-mono font-bold text-slate-800">{formatINR(liquidity.totalLiquidity)}</span>
            </p>
          </div>
          <Badge variant="emerald" size="md">{accounts.length} Active Accounts</Badge>
        </div>

        <div className="divide-y divide-slate-100 mt-2">
          {accounts.map((acc) => (
            <div key={acc._id} className="py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
              <div className="flex items-center gap-3.5">
                <div
                  className={`p-3 rounded-xl ${
                    acc.type === 'CASH'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-sky-50 text-sky-600'
                  }`}
                >
                  {acc.type === 'CASH' ? <Wallet className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-slate-900">{acc.name}</h4>
                    {acc.isDefaultCash && (
                      <Badge variant="emerald" size="sm">
                        PRIMARY COUNTER
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {acc.type === 'BANK' ? `${acc.bankName || 'Bank'} • A/c: ****${acc.accountNumber?.slice(-4) || '—'}` : 'Physical Cash Counter Drawer'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                    Balance
                  </span>
                  <p className="text-lg font-extrabold font-mono text-slate-900">
                    {formatINR(acc.balance)}
                  </p>
                </div>

                {!acc.isDefaultCash && (
                  <button
                    onClick={() => handleDelete(acc._id, acc.name, acc.isDefaultCash)}
                    title="Deactivate account"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Information Card */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-600" />
          Accounting Architecture & Integrity
        </h3>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          The system implements a double-entry repository pattern:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc list-inside">
          <li><strong>Expenses:</strong> Automatically deducted from the selected cash or bank account.</li>
          <li><strong>Credits (Receivables):</strong> Disbursed funds are deducted from your account. Repayments received add funds back in real time.</li>
          <li><strong>Pending (Payables):</strong> Borrowed money adds funds to your accounts; paybacks settle the debt by deducting from your accounts.</li>
          <li><strong>Credit Cards:</strong> Cash drawn can be directly deposited into your cash in hand counter or bank, while card payments reduce cash/bank and reduce card debt.</li>
        </ul>
      </div>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={refreshAccounts}
      />
    </div>
  );
};
