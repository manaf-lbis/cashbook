import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import {
  apiClient,
  getLocalDateString,
  getLocalTimeString,
  combineDateAndTime,
  getEffectiveEntryDateAndTime,
} from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';
import { ICreditCardTransaction, CreditCardTransactionType } from '../../../types';

interface EditCardTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ICreditCardTransaction | null;
  cardName: string;
  onSuccess: () => void;
}

export const EditCardTransactionModal: React.FC<EditCardTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  cardName,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction && isOpen) {
      setAmount(transaction.amount.toString());
      setRemarks(transaction.remarks || '');
      const { date: dVal, time: tVal } = getEffectiveEntryDateAndTime(
        transaction.date,
        (transaction as any).createdAt,
        transaction._id
      );
      setDate(dVal);
      setTime(tVal);
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const isDrawn = transaction.type !== CreditCardTransactionType.PAYMENT;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setLoading(true);
      const submitDate = date ? combineDateAndTime(date, time).toISOString() : undefined;

      await apiClient.put(`/credit-cards/transactions/${transaction._id}`, {
        amount: numAmount,
        remarks: remarks.trim() || undefined,
        description: remarks.trim() || undefined,
        date: submitDate,
      });

      showToast('Card entry updated successfully', 'success');
      await refreshAccounts();
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Card Entry - ${cardName}`}
      subtitle={`Type: ${isDrawn ? 'Cash Drawn / Purchase' : 'Card Bill Payment'}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount"
          type="number"
          prefixText="₹"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          autoFocus
          min="1"
          step="any"
        />

        <Input
          label="Description / Remarks"
          placeholder="e.g. ATM withdrawal / Shop purchase / Bill settlement"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
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

        {parseFloat(amount) !== transaction.amount && !isNaN(parseFloat(amount)) && (
          <p className="text-xs text-amber-600 font-medium">
            Previous: ₹{transaction.amount.toLocaleString('en-IN')} ➔ New: ₹{parseFloat(amount).toLocaleString('en-IN')}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={isDrawn ? 'danger' : 'success'}
            className="flex-1"
            isLoading={loading}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
