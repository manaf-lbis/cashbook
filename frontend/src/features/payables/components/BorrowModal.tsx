import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { apiClient } from '../../../api/client';
import { IAccount } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';

interface BorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: IAccount[];
  initialPartyName?: string;
  onSuccess: () => void;
}

export const BorrowModal: React.FC<BorrowModalProps> = ({
  isOpen,
  onClose,
  accounts,
  initialPartyName = '',
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();
  const [partyName, setPartyName] = useState(initialPartyName);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (initialPartyName) setPartyName(initialPartyName);
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0]._id);
    }
  }, [initialPartyName, accounts, accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    if (!accountId) {
      showToast('Please select a receiving account', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/payables/borrow', {
        partyName: partyName.trim(),
        phone: phone.trim() || undefined,
        amount: numAmount,
        accountId,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        remarks: remarks.trim() || undefined,
      });

      showToast(`Pending debt of ₹${numAmount} recorded from ${partyName}`, 'success');
      await refreshAccounts();
      onSuccess();
      onClose();

      setAmount('');
      setRemarks('');
      setDueDate('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record pending liability', 'error');
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
      title="Record Pending Payment (Borrowed / Udhar Taken)"
      subtitle="Money or goods received that we need to pay back later"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Creditor / Supplier / Lender Name"
          placeholder="e.g. Sharma Wholesale / Amit Bhai"
          value={partyName}
          onChange={(e) => setPartyName(e.target.value)}
          required
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone Number (Optional)"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Input
            label="Amount Borrowed / Received"
            type="number"
            prefixText="₹"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            min="1"
            step="any"
          />
        </div>

        <Select
          label="Received In (Account)"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accountOptions}
        />

        <Input
          label="Repayment Due Date (Optional)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <Input
          label="Remarks (Optional)"
          placeholder="e.g. Loan for stock purchase / Supplier goods on credit"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Record Pending Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
