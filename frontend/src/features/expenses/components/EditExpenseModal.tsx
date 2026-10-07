import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { apiClient, getLocalDateString, getLocalTimeString } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';
import { IExpense } from '../../../types';

interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: IExpense | null;
  onSuccess: () => void;
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  isOpen,
  onClose,
  expense,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setAmount(expense.amount.toString());
      const expDate = expense.date ? new Date(expense.date) : new Date();
      setDate(getLocalDateString(expDate));
      setTime(getLocalTimeString(expDate));
    }
  }, [expense, isOpen]);

  if (!isOpen || !expense) return null;

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
      let submitDate: string | undefined = undefined;
      if (date) {
        const localDateTime = new Date(`${date}T${time || '12:00'}:00`);
        submitDate = !isNaN(localDateTime.getTime()) ? localDateTime.toISOString() : undefined;
      }

      await apiClient.put(`/expenses/${expense._id}`, {
        title: title.trim(),
        amount: numAmount,
        date: submitDate,
      });

      showToast(`Expense updated!`, 'success');
      await refreshAccounts();
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Expense - ${expense.category}`}
      subtitle="Modify title and amount"
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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="Time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        {parseFloat(amount) !== expense.amount && !isNaN(parseFloat(amount)) && (
          <p className="text-xs text-amber-600 font-medium">
            Previous: ₹{expense.amount.toLocaleString('en-IN')} ➔ New: ₹{parseFloat(amount).toLocaleString('en-IN')}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1" isLoading={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
