import React, { useState, useEffect } from 'react';
import { X, Receipt, ChevronDown, ChevronUp, Calendar, Tag, CreditCard, Sparkles } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';
import { IBiller } from '../../../types';
import { Button } from '../../../components/ui/Button';

interface AddSalesEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  billers: IBiller[];
  defaultBillerId?: string;
  monthKey: string;
}

export const AddSalesEntryModal: React.FC<AddSalesEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  billers,
  defaultBillerId,
  monthKey,
}) => {
  const { showToast } = useToast();
  const { accounts, refreshAccounts } = useAccounts();

  // Core sales recording fields: Price, Description, Date (default current)
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Optional / Counter / Payment fields
  const [billerId, setBillerId] = useState(defaultBillerId || (billers[0]?._id ?? ''));
  const [accountId, setAccountId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK' | 'UPI'>('CASH');
  const [billNumber, setBillNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultBillerId) {
      setBillerId(defaultBillerId);
    } else if (billers.length > 0 && !billerId) {
      setBillerId(billers[0]._id);
    }
  }, [defaultBillerId, billers, billerId]);

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      const defaultCash = accounts.find((a) => a.isDefaultCash) || accounts[0];
      setAccountId(defaultCash._id);
    }
  }, [accounts, accountId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid price/sales amount', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.post('/daybook/entries', {
        amount: numAmount,
        remarks: description.trim() || undefined,
        description: description.trim() || undefined,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        billerId: billerId || undefined,
        accountId: accountId || undefined,
        paymentMode,
        billNumber: billNumber.trim() || undefined,
        customerName: customerName.trim() || undefined,
      });

      if (res.data.success) {
        showToast('Sale recorded successfully!', 'success');
        refreshAccounts();
        setAmount('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setBillNumber('');
        setCustomerName('');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record sale', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Record Sale</h3>
              <p className="text-xs text-slate-500">Enter price, description & date (default current)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 1. Price / Amount */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 tracking-wider mb-1">
              Price / Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base font-bold">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-300 bg-white text-lg font-bold font-mono text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
                autoFocus
              />
            </div>
          </div>

          {/* 2. Description */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 tracking-wider mb-1">
              Description
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Grocery items, customer sale, hardware..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* 3. Date (Defaults to current date) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold uppercase text-slate-600 tracking-wider">
                Date
              </label>
              <span className="text-[11px] text-emerald-600 font-medium">Default: Current Date</span>
            </div>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>
          </div>

          {/* Collapsible / Optional Counter & Payment Details */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 transition-colors"
            >
              <span>More Options (Counter, Payment Mode, Customer, Bill #)</span>
              {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showMoreOptions && (
              <div className="pt-3 space-y-3 animate-in fade-in duration-150">
                {/* Billing Person */}
                {billers.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Billing Person / Counter
                    </label>
                    <select
                      value={billerId}
                      onChange={(e) => setBillerId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      {billers.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name} ({b.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Account & Payment Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Deposit To Account
                    </label>
                    <select
                      value={accountId}
                      onChange={(e) => {
                        setAccountId(e.target.value);
                        const sel = accounts.find((a) => a._id === e.target.value);
                        if (sel?.type === 'CASH') setPaymentMode('CASH');
                        else setPaymentMode('UPI');
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      {accounts.map((acc) => (
                        <option key={acc._id} value={acc._id}>
                          {acc.name} (₹{acc.balance.toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="CASH">Cash in Hand</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="BANK">Bank Transfer / Card</option>
                    </select>
                  </div>
                </div>

                {/* Customer Name & Bill No */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Customer Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Suresh Kumar"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Bill / Invoice # (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-1048"
                      value={billNumber}
                      onChange={(e) => setBillNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Sale ₹'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
