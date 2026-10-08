import React, { useState, useEffect } from 'react';
import { X, Edit3, History, Check, Clock } from 'lucide-react';
import {
  apiClient,
  formatINR,
  formatDateTime,
  getLocalDateString,
  getLocalTimeString,
  combineDateAndTime,
  getEffectiveEntryDateAndTime,
} from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';
import { IDayBookEntry } from '../../../types';
import { Button } from '../../../components/ui/Button';

interface EditSalesEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: IDayBookEntry | null;
}

export const EditSalesEntryModal: React.FC<EditSalesEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  entry,
}) => {
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (entry && isOpen) {
      setAmount(entry.amount.toString());
      setDescription(entry.remarks || '');
      setCustomerName(entry.customerName || '');
      setBillNumber(entry.billNumber || '');
      const { date: dVal, time: tVal } = getEffectiveEntryDateAndTime(
        entry.date,
        entry.createdAt,
        entry._id
      );
      setDate(dVal);
      setTime(tVal);
      setNote('');
      setShowHistory(false);
    }
  }, [entry, isOpen]);

  if (!isOpen || !entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const submitDate = date ? combineDateAndTime(date, time).toISOString() : undefined;

      const res = await apiClient.put(`/daybook/entries/${entry._id}`, {
        amount: numAmount,
        remarks: description.trim() || undefined,
        description: description.trim() || undefined,
        customerName: customerName.trim() || undefined,
        billNumber: billNumber.trim() || undefined,
        date: submitDate,
        note: note.trim() || undefined,
      });

      if (res.data.success) {
        showToast('Sales entry updated and logged!', 'success');
        refreshAccounts();
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update entry', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editLogs = entry.editLogs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Edit Sales Entry</h3>
                {entry.isEdited && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Edited ({editLogs.length})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Changes will be logged in the audit trail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <form id="edit-entry-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sales Amount / Price <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 text-base font-bold font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-900"
                />
              </div>
              {parseFloat(amount) !== entry.amount && !isNaN(parseFloat(amount)) && (
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  Previous: ₹{entry.amount.toLocaleString('en-IN')} ➔ New: ₹{parseFloat(amount).toLocaleString('en-IN')} (Diff: {parseFloat(amount) - entry.amount >= 0 ? '+' : ''}{formatINR(parseFloat(amount) - entry.amount)})
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Description / Remarks
              </label>
              <input
                type="text"
                placeholder="e.g. Rice 10kg, Counter Cash, Customer Name"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-800"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sale Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sale Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-800"
                />
              </div>
            </div>

            {/* Bill / Token # */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Bill / Token #
              </label>
              <input
                type="text"
                placeholder="e.g. B-1049"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-800 font-mono"
              />
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe / Walk-in"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-800"
              />
            </div>

            {/* Reason for Edit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for Edit (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Corrected typo in amount / Customer item change"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-800"
              />
            </div>
          </form>

          {/* Edit Logs Accordion / History */}
          {editLogs.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 cursor-pointer py-1"
              >
                <History className="w-3.5 h-3.5" />
                {showHistory ? 'Hide Edit History Log' : `View Edit History Log (${editLogs.length} previous edit${editLogs.length > 1 ? 's' : ''})`}
              </button>

              {showHistory && (
                <div className="mt-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2.5 max-h-48 overflow-y-auto">
                  {editLogs.map((log, index) => (
                    <div key={index} className="text-xs border-b border-amber-100 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          {formatDateTime(log.editedAt)}
                        </span>
                        {log.reason && (
                          <span className="italic font-medium text-slate-600">"{log.reason}"</span>
                        )}
                      </div>
                      <div className="font-mono text-slate-800 flex items-center gap-2">
                        <span className="text-slate-400 line-through">₹{log.previousAmount.toLocaleString('en-IN')}</span>
                        <span>➔</span>
                        <span className="font-bold text-amber-700">₹{log.newAmount.toLocaleString('en-IN')}</span>
                      </div>
                      {log.previousRemarks !== log.newRemarks && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Remarks: <span className="line-through">{log.previousRemarks || 'None'}</span> ➔ <span className="font-medium text-slate-700">{log.newRemarks || 'None'}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-entry-form"
            variant="primary"
            isLoading={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Save & Log Edit
          </Button>
        </div>
      </div>
    </div>
  );
};
