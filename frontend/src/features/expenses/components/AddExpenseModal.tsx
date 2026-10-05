import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  onSuccess: () => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  categoryName,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid expense amount', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('Please enter an expense title', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/expenses', {
        title: title.trim(),
        amount: numAmount,
        category: categoryName || 'Shop Expenses',
      });

      showToast(`Expense "${title.trim()}" (₹${numAmount}) recorded!`, 'success');
      await refreshAccounts();
      onSuccess();
      onClose();

      setTitle('');
      setAmount('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Expense - ${categoryName || 'Shop Expenses'}`}
      subtitle="Only title and amount required"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Expense Title"
          placeholder="e.g. Office supply, Courier speed post, Printing paper..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Amount"
          type="number"
          prefixText="₹"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="0.01"
          step="any"
        />

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" className="flex-1" isLoading={loading}>
            Save Expense ₹
          </Button>
        </div>
      </form>
    </Modal>
  );
};
