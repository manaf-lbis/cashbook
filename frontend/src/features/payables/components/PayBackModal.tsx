import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { apiClient, formatINR } from '../../../api/client';
import { IPayable, IAccount } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';

interface PayBackModalProps {
  isOpen: boolean;
  onClose: () => void;
  payable: IPayable | null;
  accounts: IAccount[];
  onSuccess: () => void;
}

export const PayBackModal: React.FC<PayBackModalProps> = ({
  isOpen,
  onClose,
  payable,
  accounts,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0]._id);
    }
  }, [accounts, accountId]);

  if (!payable) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    if (!accountId) {
      showToast('Please select an account to pay from', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post(`/payables/${payable._id}/payback`, {
        amount: numAmount,
        accountId,
        remarks: remarks.trim() || undefined,
      });

      showToast(`Repayment of ₹${numAmount} paid to ${payable.partyName}`, 'success');
      await refreshAccounts();
      onSuccess();
      onClose();

      setAmount('');
      setRemarks('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record payback', 'error');
    } finally {
      setLoading(false);
    }
  };

  const accountOptions = accounts.map((acc) => ({
    value: acc._id,
    label: `${acc.name} (${acc.type}) - Balance: ₹${acc.balance.toLocaleString('en-IN')}`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pay Back Pending Amount"
      subtitle={`Paying back money to ${payable.partyName}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
          <span className="font-semibold text-rose-900">Total Pending to Pay:</span>
          <span className="font-mono font-bold text-rose-900 text-sm">
            {formatINR(payable.balancePending)}
          </span>
        </div>

        <Input
          label="Payment Amount"
          type="number"
          prefixText="₹"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="1"
          max={payable.balancePending}
          step="any"
          autoFocus
        />

        <Select
          label="Pay From (Account)"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accountOptions}
        />

        <Input
          label="Remarks (Optional)"
          placeholder="e.g. Paid via UPI / Counter cash settlement"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={loading}>
            Confirm Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
