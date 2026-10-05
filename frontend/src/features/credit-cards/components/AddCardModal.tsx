import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COLOR_OPTIONS = [
  { label: 'Royal Indigo', value: 'indigo' },
  { label: 'Dark Slate / Charcoal', value: 'slate' },
  { label: 'Emerald Green', value: 'emerald' },
  { label: 'Amber Gold', value: 'amber' },
  { label: 'Crimson Rose', value: 'rose' },
];

export const AddCardModal: React.FC<AddCardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [cardName, setCardName] = useState('');
  const [bankName, setBankName] = useState('');
  const [last4Digits, setLast4Digits] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [billingCycleDate, setBillingCycleDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [colorTheme, setColorTheme] = useState('indigo');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numLimit = parseFloat(creditLimit);
    if (isNaN(numLimit) || numLimit <= 0) {
      showToast('Please enter a valid credit limit', 'error');
      return;
    }
    if (last4Digits.length !== 4 || isNaN(parseInt(last4Digits))) {
      showToast('Last 4 digits must be exactly 4 numbers', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/credit-cards', {
        cardName: cardName.trim(),
        bankName: bankName.trim(),
        last4Digits,
        creditLimit: numLimit,
        billingCycleDate: billingCycleDate ? parseInt(billingCycleDate) : undefined,
        dueDate: dueDate ? parseInt(dueDate) : undefined,
        colorTheme,
      });

      showToast(`Credit Card "${cardName}" added successfully`, 'success');
      onSuccess();
      onClose();

      // Reset
      setCardName('');
      setBankName('');
      setLast4Digits('');
      setCreditLimit('');
      setBillingCycleDate('');
      setDueDate('');
    } catch (err: any) {
      showToast(err.message || 'Failed to add card', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Credit Card"
      subtitle="Register a new credit card to track spends, cash drawn, and bill payments"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Card Name / Nickname"
          placeholder="e.g. HDFC Regalia / ICICI Amazon Pay"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          required
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Bank / Issuer Name"
            placeholder="e.g. HDFC Bank / SBI Cards"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            required
          />

          <Input
            label="Last 4 Digits"
            placeholder="e.g. 8821"
            maxLength={4}
            value={last4Digits}
            onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>

        <Input
          label="Total Credit Limit"
          type="number"
          prefixText="₹"
          placeholder="e.g. 150000"
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value)}
          required
          min="1"
          step="any"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Bill Date (Day)"
            type="number"
            placeholder="1-31"
            min="1"
            max="31"
            value={billingCycleDate}
            onChange={(e) => setBillingCycleDate(e.target.value)}
          />

          <Input
            label="Due Date (Day)"
            type="number"
            placeholder="1-31"
            min="1"
            max="31"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <Select
            label="Card Theme"
            value={colorTheme}
            onChange={(e) => setColorTheme(e.target.value)}
            options={COLOR_OPTIONS}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Add Card
          </Button>
        </div>
      </form>
    </Modal>
  );
};
