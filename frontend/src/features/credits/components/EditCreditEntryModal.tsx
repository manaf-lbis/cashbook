import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { apiClient, getLocalDateString, getLocalTimeString } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';
import { ICreditEntry, CreditTransactionType } from '../../../types';

interface EditCreditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditId: string;
  entry: ICreditEntry | null;
  partyName: string;
  onSuccess: () => void;
}

export const EditCreditEntryModal: React.FC<EditCreditEntryModalProps> = ({
  isOpen,
  onClose,
  creditId,
  entry,
  partyName,
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
    if (entry) {
      setAmount(entry.amount.toString());
      setRemarks(entry.remarks || '');
      const entryDate = entry.date ? new Date(entry.date) : new Date();
      setDate(getLocalDateString(entryDate));
      setTime(getLocalTimeString(entryDate));
    }
  }, [entry, isOpen]);

  if (!isOpen || !entry) return null;

  const isGiven = entry.type === CreditTransactionType.GIVEN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setLoading(true);
      let submitDate: string | undefined = undefined;
      if (date) {
        const localDateTime = new Date(`${date}T${time || '12:00'}:00`);
        submitDate = !isNaN(localDateTime.getTime()) ? localDateTime.toISOString() : undefined;
      }

      await apiClient.put(`/credits/${creditId}/entries/${entry._id}`, {
        amount: numAmount,
        remarks: remarks.trim() || undefined,
        date: submitDate,
      });

      showToast('Entry updated successfully', 'success');
      await refreshAccounts();
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update entry', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Entry - ${partyName}`}
      subtitle={`Type: ${isGiven ? "You Gave (Credit)" : "You Got (Repayment)"}`}
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
          placeholder="e.g. Item details or payment note"
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

        {parseFloat(amount) !== entry.amount && !isNaN(parseFloat(amount)) && (
          <p className="text-xs text-amber-600 font-medium">
            Previous: ₹{entry.amount.toLocaleString('en-IN')} ➔ New: ₹{parseFloat(amount).toLocaleString('en-IN')}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={isGiven ? 'danger' : 'success'}
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
