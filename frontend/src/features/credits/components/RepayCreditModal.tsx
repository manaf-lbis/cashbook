import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { apiClient, formatINR } from '../../../api/client';
import { ICredit, IAccount } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';

interface RepayCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  credit: ICredit | null;
  accounts?: IAccount[];
  onSuccess: () => void;
}

export const RepayCreditModal: React.FC<RepayCreditModalProps> = ({
  isOpen,
  onClose,
  credit,
  accounts = [],
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

  if (!credit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid repayment amount', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post(`/credits/${credit._id}/repay`, {
        amount: numAmount,
        remarks: remarks.trim() || undefined,
      });

      showToast(`Repayment of ₹${numAmount} deposited into Cash Drawer`, 'success');
      await refreshAccounts();
      onSuccess();
      onClose();

      setAmount('');
      setRemarks('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record repayment', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Collect Credit Repayment"
      subtitle={`Receiving money back from ${credit.partyName}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
          <span className="font-semibold text-amber-900">Current Balance Due:</span>
          <span className="font-mono font-bold text-amber-900 text-sm">
            {formatINR(credit.balanceDue)}
          </span>
        </div>

        <Input
          label="Repayment Amount Received"
          type="number"
          prefixText="₹"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="1"
          max={credit.balanceDue}
          step="any"
          autoFocus
        />

        <Input
          label="Remarks (Optional)"
          placeholder="e.g. Cash handed over at shop counter"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="success" isLoading={loading}>
            Record Repayment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
