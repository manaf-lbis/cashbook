import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
} from 'lucide-react';
import { apiClient, formatINR, formatDate, formatDateTime } from '../../api/client';
import { IPayable, IPayableEntry, PayableTransactionType, ApiResponse } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAccounts } from '../../context/AccountContext';
import { EditPayableEntryModal } from './components/EditPayableEntryModal';

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-800',
  'bg-amber-100 text-amber-800',
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-emerald-100 text-emerald-800',
];

export const PayablesPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { accounts, refreshAccounts } = useAccounts();
  const [payables, setPayables] = useState<IPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('RECENT');

  // Currently selected supplier
  const [selectedPayable, setSelectedPayable] = useState<IPayable | null>(null);

  // Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isTookModalOpen, setIsTookModalOpen] = useState(false);
  const [isPaidModalOpen, setIsPaidModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IPayableEntry | null>(null);

  // Form states
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add supplier form
  const [newSuppName, setNewSuppName] = useState('');
  const [newSuppPhone, setNewSuppPhone] = useState('');
  const [initialAmount, setInitialAmount] = useState('');

  const fetchPayables = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<ApiResponse<IPayable[]>>('/payables');
      if (res.data.success) {
        setPayables(res.data.data);
        if (res.data.data.length > 0 && !selectedPayable) {
          setSelectedPayable(res.data.data[0]);
        } else if (selectedPayable) {
          const updated = res.data.data.find((p) => p._id === selectedPayable._id);
          if (updated) setSelectedPayable(updated);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedPayable?._id]);

  useEffect(() => {
    fetchPayables();
  }, [fetchPayables]);

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0]._id);
    }
  }, [accounts, accountId]);

  const handleDeletePayableEntry = async (entry: IPayableEntry) => {
    if (!selectedPayable || entry.isDeleted) return;
    if (
      !window.confirm(
        `Are you sure you want to delete this payable entry of ₹${entry.amount.toLocaleString(
          'en-IN'
        )}? It will be marked with a red strike, a DELETED badge, and excluded from supplier pending dues.`
      )
    ) {
      return;
    }

    try {
      await apiClient.delete(`/payables/${selectedPayable._id}/entries/${entry._id}`);
      showToast('Payable entry marked as deleted', 'success');
      fetchPayables();
      refreshAccounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete payable entry', 'error');
    }
  };

  // Totals
  const totalYouWillPay = payables.reduce((sum, p) => sum + (p.status === 'ACTIVE' ? p.balancePending : 0), 0);

  // Filter & Sort
  const filteredPayables = payables
    .filter((p) => {
      if (filterType === 'DUE') return p.balancePending > 0;
      if (filterType === 'SETTLED') return p.balancePending <= 0;
      return true;
    })
    .filter(
      (p) =>
        p.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.phone && p.phone.includes(searchQuery))
    )
    .sort((a, b) => {
      if (sortBy === 'AMOUNT_HIGH') return b.balancePending - a.balancePending;
      if (sortBy === 'AMOUNT_LOW') return a.balancePending - b.balancePending;
      if (sortBy === 'NAME') return a.partyName.localeCompare(b.partyName);
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

  // Handle Add Supplier
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppName.trim()) {
      showToast('Please enter supplier name', 'error');
      return;
    }
    const numAmount = initialAmount ? parseFloat(initialAmount) : 0;

    try {
      setSubmitting(true);
      const res = await apiClient.post<ApiResponse<IPayable>>('/payables/borrow', {
        partyName: newSuppName.trim(),
        phone: newSuppPhone.trim() || undefined,
        amount: numAmount > 0 ? numAmount : 0.01,
        remarks: numAmount > 0 ? 'Opening pending balance' : 'Supplier account created',
      });

      showToast(`Supplier "${newSuppName}" added!`, 'success');
      await refreshAccounts();
      await fetchPayables();
      if (res.data.data) {
        setSelectedPayable(res.data.data);
      }
      setIsAddSupplierOpen(false);
      setNewSuppName('');
      setNewSuppPhone('');
      setInitialAmount('');
    } catch (err: any) {
      showToast(err.message || 'Failed to add supplier', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle You Took
  const handleYouTookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/payables/borrow', {
        partyName: selectedPayable.partyName,
        phone: selectedPayable.phone,
        amount: num,
        remarks: remarks.trim() || 'Goods / Borrowed funds into Drawer',
      });

      showToast(`₹${num} recorded under You Took (into Drawer)`, 'success');
      await refreshAccounts();
      await fetchPayables();
      setIsTookModalOpen(false);
      setAmount('');
      setRemarks('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record borrowing', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle You Paid
  const handleYouPaidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post(`/payables/${selectedPayable._id}/payback`, {
        amount: num,
        remarks: remarks.trim() || 'Payment paid from Drawer',
      });

      showToast(`₹${num} recorded under You Paid (from Drawer)!`, 'success');
      await refreshAccounts();
      await fetchPayables();
      setIsPaidModalOpen(false);
      setAmount('');
      setRemarks('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record payback', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const accountOptions = accounts.map((acc) => ({
    value: acc._id,
    label: `${acc.name} (${acc.type}) - Balance: ₹${acc.balance.toLocaleString('en-IN')}`,
  }));

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white select-none">
      {/* ======================================================== */}
      {/* MIDDLE PANE: SUPPLIERS MASTER LIST                      */}
      {/* ======================================================== */}
      <div
        className={`w-full md:w-[420px] lg:w-[460px] flex-shrink-0 flex flex-col h-full border-r border-slate-200 bg-white ${
          selectedPayable ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Tabs (Customers vs Suppliers) */}
        <div className="flex items-center px-5 pt-3.5 border-b border-slate-200 gap-6">
          <button
            onClick={() => navigate('/credits')}
            className="pb-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
          >
            Customers
          </button>
          <button className="pb-2.5 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2">
            Suppliers <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{payables.length}</span>
          </button>
        </div>

        {/* Top Cumulative Summary Row */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between text-sm">
          <div>
            <span className="text-slate-500 font-medium">You'll Pay:</span>{' '}
            <span className="font-mono font-black text-rose-600 text-base">
              ₹{totalYouWillPay.toLocaleString('en-IN')} ↗
            </span>
          </div>

          <div>
            <span className="text-slate-500 font-medium">You'll Get:</span>{' '}
            <span className="font-mono font-bold text-emerald-600 text-base">₹0 ↙</span>
          </div>

          <button
            onClick={() => window.print()}
            className="text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50/80 hover:bg-blue-100 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-4 h-4" /> View Report
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-3.5 border-b border-slate-200 space-y-3 bg-white">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Search for suppliers
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Name or Phone Number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Filter By</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Suppliers</option>
                <option value="DUE">Pending (To Pay)</option>
                <option value="SETTLED">Settled (₹0)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none"
              >
                <option value="RECENT">Recent Activity</option>
                <option value="AMOUNT_HIGH">Amount: High to Low</option>
                <option value="AMOUNT_LOW">Amount: Low to High</option>
                <option value="NAME">Name: A to Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Supplier Table List Header */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span>NAME</span>
          <span>AMOUNT</span>
        </div>

        {/* Suppliers List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <LoadingSpinner message="Loading suppliers..." />
          ) : filteredPayables.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No suppliers found. Click <strong>+ Add Supplier</strong> below.
            </div>
          ) : (
            filteredPayables.map((s) => {
              const isSelected = selectedPayable?._id === s._id;
              const avatarClass = getAvatarColor(s.partyName);
              const initial = s.partyName.charAt(0).toUpperCase();

              return (
                <div
                  key={s._id}
                  onClick={() => setSelectedPayable(s)}
                  className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center flex-shrink-0 ${avatarClass}`}
                    >
                      {initial}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {s.partyName}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(s.updatedAt || s.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-mono font-bold ${
                        s.balancePending > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    >
                      ₹{s.balancePending.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {s.balancePending > 0 ? "YOU'LL PAY" : 'SETTLED'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Button Bar: + Add Supplier */}
        <div className="p-3.5 border-t border-slate-200 bg-white">
          <button
            onClick={() => setIsAddSupplierOpen(true)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Add Supplier
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT PANE: DETAIL LEDGER STREAM                         */}
      {/* ======================================================== */}
      <div
        className={`flex-1 flex flex-col h-full bg-white overflow-hidden ${
          selectedPayable ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedPayable ? (
          <>
            {/* Top Supplier Bar */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => setSelectedPayable(null)}
                  className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg -ml-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div
                  className={`w-11 h-11 rounded-full font-bold text-base flex items-center justify-center ${getAvatarColor(
                    selectedPayable.partyName
                  )}`}
                >
                  {selectedPayable.partyName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {selectedPayable.partyName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {selectedPayable.phone || 'No phone number'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <button
                  onClick={() => window.print()}
                  className="text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-4 h-4 text-slate-500" /> Report
                </button>

                <div className="text-right border-l border-slate-200 pl-5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    NET BALANCE:
                  </span>
                  <span className="text-base font-black font-mono text-rose-600">
                    You'll Pay: ₹{selectedPayable.balancePending.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Table Header */}
            <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>ENTRIES</span>
              <div className="flex items-center gap-16 pr-4">
                <span className="w-20 text-right">YOU TOOK</span>
                <span className="w-20 text-right">YOU PAID</span>
                <span className="w-8 text-center">EDIT</span>
              </div>
            </div>

            {/* Entries Stream */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-6">
              {selectedPayable.entries && selectedPayable.entries.length > 0 ? (
                [...selectedPayable.entries].reverse().map((entry, idx) => {
                  const isDeleted = !!entry.isDeleted;
                  return (
                    <div
                      key={entry._id || idx}
                      className={`py-3.5 flex items-center justify-between transition-colors ${
                        isDeleted ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-bold font-mono ${
                              isDeleted
                                ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                : 'text-slate-800'
                            }`}
                          >
                            {formatDateTime(entry.date)}
                          </p>
                          {isDeleted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 uppercase tracking-wider shadow-2xs">
                              DELETED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Balance: ₹{selectedPayable.balancePending.toLocaleString('en-IN')}
                        </p>
                        <p
                          className={`text-sm mt-1 font-medium ${
                            isDeleted
                              ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                              : 'text-slate-600'
                          }`}
                        >
                          {entry.remarks ||
                            (entry.type === PayableTransactionType.BORROWED
                              ? 'Stock / Borrowed'
                              : 'Payment')}
                        </p>
                      </div>

                      <div className="flex items-center gap-8 sm:gap-14 pr-4">
                        {/* YOU TOOK */}
                        <div className="w-20 text-right font-mono font-bold text-sm">
                          {entry.type === PayableTransactionType.BORROWED ? (
                            <span
                              className={
                                isDeleted
                                  ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                  : 'text-rose-600'
                              }
                            >
                              ₹{entry.amount.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>

                        {/* YOU PAID */}
                        <div className="w-20 text-right font-mono font-bold text-sm">
                          {entry.type === PayableTransactionType.PAID ? (
                            <span
                              className={
                                isDeleted
                                  ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                  : 'text-emerald-600'
                              }
                            >
                              ₹{entry.amount.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="w-16 text-center flex items-center justify-center gap-1">
                          {!isDeleted ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingEntry(entry)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit this entry"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePayableEntry(entry)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete this entry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-300 font-semibold">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-24 text-center text-sm text-slate-400">
                  No entries recorded yet. Click <strong>You Took ₹</strong> or <strong>You Paid ₹</strong> below.
                </div>
              )}
            </div>

            {/* Bottom Action Buttons (Exact image pastel styling) */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                <button
                  onClick={() => {
                    setAmount('');
                    setRemarks('');
                    setIsTookModalOpen(true);
                  }}
                  className="py-3.5 px-4 rounded-xl bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] font-bold text-base transition-colors shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  You Took ₹
                </button>

                <button
                  onClick={() => {
                    setAmount('');
                    setRemarks('');
                    setIsPaidModalOpen(true);
                  }}
                  className="py-3.5 px-4 rounded-xl bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#16a34a] font-bold text-base transition-colors shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  You Paid ₹
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <p className="text-base font-semibold">Select a supplier from the list to view their ledger</p>
          </div>
        )}
      </div>

      {/* Modal: Add Supplier */}
      <Modal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        title="Add New Supplier"
        subtitle="Supplier will appear in your ledger list"
      >
        <form onSubmit={handleAddSupplier} className="space-y-4">
          <Input
            label="Supplier / Vendor Name"
            placeholder="e.g. Shri Ganesh Traders"
            value={newSuppName}
            onChange={(e) => setNewSuppName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="e.g. 9876543210"
            value={newSuppPhone}
            onChange={(e) => setNewSuppPhone(e.target.value)}
          />

          <Input
            label="Opening Due Amount (Optional)"
            type="number"
            prefixText="₹"
            placeholder="0.00"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            min="0"
            step="any"
          />



          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddSupplierOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" isLoading={submitting}>
              Add Supplier
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: You Took ₹ */}
      {selectedPayable && (
        <Modal
          isOpen={isTookModalOpen}
          onClose={() => setIsTookModalOpen(false)}
          title={`You Took ₹ from ${selectedPayable.partyName}`}
          subtitle="Money or stock borrowed that you need to pay back"
        >
          <form onSubmit={handleYouTookSubmit} className="space-y-4">
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
              label="Description / Bill Details (Optional)"
              placeholder="e.g. 10 bags cement / cash loan"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsTookModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" className="flex-1" isLoading={submitting}>
                Save (You Took)
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: You Paid ₹ */}
      {selectedPayable && (
        <Modal
          isOpen={isPaidModalOpen}
          onClose={() => setIsPaidModalOpen(false)}
          title={`You Paid ₹ to ${selectedPayable.partyName}`}
          subtitle="Repayment paid to supplier"
        >
          <form onSubmit={handleYouPaidSubmit} className="space-y-4">
            <Input
              label="Amount Paid"
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
              label="Description / Payment Method (Optional)"
              placeholder="e.g. Cash paid / NEFT"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsPaidModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="success" className="flex-1" isLoading={submitting}>
                Save (You Paid)
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Edit Payable Entry */}
      {selectedPayable && (
        <EditPayableEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          payableId={selectedPayable._id}
          entry={editingEntry}
          partyName={selectedPayable.partyName}
          onSuccess={() => {
            fetchPayables();
          }}
        />
      )}
    </div>
  );
};
