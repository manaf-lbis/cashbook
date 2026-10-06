import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { apiClient } from '../../../api/client';
import { IAccount } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';

interface GiveCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: IAccount[];
  initialPartyName?: string;
  onSuccess: () => void;
}

export const GiveCreditModal: React.FC<GiveCreditModalProps> = ({
  isOpen,
  onClose,
  accounts = [],
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
      showToast('Please enter a valid credit amount', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/credits/give', {
        partyName: partyName.trim(),
        phone: phone.trim() || undefined,
        amount: numAmount,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        remarks: remarks.trim() || undefined,
      });

      showToast(`Credit of ₹${numAmount} given from Cash Drawer to ${partyName}`, 'success');
      await refreshAccounts();
      onSuccess();
      onClose();

      // Reset
      setAmount('');
      setRemarks('');
      setDueDate('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record credit', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Give Credit (Udhar / Receivable)"
      subtitle="Money given out from shop funds to be returned later"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Party / Customer / Borrower Name"
          placeholder="e.g. Ramesh Kumar"
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
            label="Amount Given"
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

        <Input
          label="Expected Return Date (Optional)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <Input
          label="Remarks (Optional)"
          placeholder="e.g. Goods taken on credit / Personal advance"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Confirm & Disburse
          </Button>
        </div>
      </form>
    </Modal>
  );
};
