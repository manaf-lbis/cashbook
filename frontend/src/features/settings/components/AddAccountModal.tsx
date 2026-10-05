import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { apiClient } from '../../../api/client';
import { AccountType } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(AccountType.BANK);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numBalance = balance ? parseFloat(balance) : 0;
    if (isNaN(numBalance) || numBalance < 0) {
      showToast('Please enter a valid initial balance', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/accounts', {
        name: name.trim(),
        type,
        bankName: type === AccountType.BANK ? bankName.trim() : undefined,
        accountNumber: type === AccountType.BANK ? accountNumber.trim() : undefined,
        ifscCode: type === AccountType.BANK ? ifscCode.trim() : undefined,
        balance: numBalance,
      });

      showToast(`Account "${name}" created successfully`, 'success');
      await refreshAccounts();
      onSuccess();
      onClose();

      setName('');
      setBankName('');
      setAccountNumber('');
      setIfscCode('');
      setBalance('');
    } catch (err: any) {
      showToast(err.message || 'Failed to create account', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Bank / Cash Account"
      subtitle="Register a new shop financial account to track in the Cash Book"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Account Display Name"
          placeholder="e.g. Kotak Mahindra Current A/c"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <Select
          label="Account Type"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          options={[
            { value: AccountType.BANK, label: 'Bank Account' },
            { value: AccountType.CASH, label: 'Cash Account' },
          ]}
        />

        {type === AccountType.BANK && (
          <>
            <Input
              label="Bank Name"
              placeholder="e.g. Kotak Mahindra Bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Account Number (Optional)"
                placeholder="e.g. 9821004128"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />

              <Input
                label="IFSC Code (Optional)"
                placeholder="e.g. KKBK0000123"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
              />
            </div>
          </>
        )}

        <Input
          label="Opening / Initial Balance"
          type="number"
          prefixText="₹"
          placeholder="0.00"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          min="0"
          step="any"
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Save Account
          </Button>
        </div>
      </form>
    </Modal>
  );
};
