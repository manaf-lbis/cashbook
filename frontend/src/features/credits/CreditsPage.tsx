import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Lock,
} from 'lucide-react';
import { apiClient, formatINR, formatDate, formatDateTime, formatEntryDateTime } from '../../api/client';
import { ICredit, ICreditEntry, CreditTransactionType, ApiResponse } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAccounts } from '../../context/AccountContext';
import { EditCreditEntryModal } from './components/EditCreditEntryModal';

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-800',
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-indigo-100 text-indigo-800',
];

export const CreditsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { accounts, refreshAccounts } = useAccounts();
  const [credits, setCredits] = useState<ICredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('RECENT');

  // Currently selected customer
  const [selectedCredit, setSelectedCredit] = useState<ICredit | null>(null);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isGiveModalOpen, setIsGiveModalOpen] = useState(false);
  const [isGotModalOpen, setIsGotModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ICreditEntry | null>(null);

  // Form states
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add customer form
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [initialAmount, setInitialAmount] = useState('');

  const fetchCredits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<ApiResponse<ICredit[]>>('/credits');
      if (res.data.success) {
        setCredits(res.data.data);
        if (res.data.data.length > 0 && !selectedCredit) {
          setSelectedCredit(res.data.data[0]);
        } else if (selectedCredit) {
          const updated = res.data.data.find((c) => c._id === selectedCredit._id);
          if (updated) setSelectedCredit(updated);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load credits', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedCredit?._id]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0]._id);
    }
  }, [accounts, accountId]);

  const handleDeleteCreditEntry = async (entry: ICreditEntry) => {
    if (!selectedCredit || entry.isDeleted) return;
    if (
      !window.confirm(
        `Are you sure you want to delete this credit entry of ₹${entry.amount.toLocaleString(
          'en-IN'
        )}? It will be marked with a red strike, a DELETED badge, and excluded from customer balances.`
      )
    ) {
      return;
    }

    try {
      await apiClient.delete(`/credits/${selectedCredit._id}/entries/${entry._id}`);
      showToast('Credit entry marked as deleted', 'success');
      fetchCredits();
      refreshAccounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete credit entry', 'error');
    }
  };

  // Totals
  const totalYouWillGet = credits.reduce((sum, c) => sum + (c.status === 'ACTIVE' ? c.balanceDue : 0), 0);

  // Filter & Sort
  const filteredCredits = credits
    .filter((c) => {
      if (filterType === 'DUE') return c.balanceDue > 0;
      if (filterType === 'SETTLED') return c.balanceDue <= 0;
      return true;
    })
    .filter(
      (c) =>
        c.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery))
    )
    .sort((a, b) => {
      if (sortBy === 'AMOUNT_HIGH') return b.balanceDue - a.balanceDue;
      if (sortBy === 'AMOUNT_LOW') return a.balanceDue - b.balanceDue;
      if (sortBy === 'NAME') return a.partyName.localeCompare(b.partyName);
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

  // Handle Add Customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      showToast('Please enter customer name', 'error');
      return;
    }
    const numAmount = initialAmount ? parseFloat(initialAmount) : 0;

    try {
      setSubmitting(true);
      const res = await apiClient.post<ApiResponse<ICredit>>('/credits/give', {
        partyName: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        amount: numAmount > 0 ? numAmount : 0.01,
        remarks: numAmount > 0 ? 'Opening credit balance' : 'Customer account created',
      });

      showToast(`Customer "${newCustName}" added!`, 'success');
      await refreshAccounts();
      await fetchCredits();
      if (res.data.data) {
        setSelectedCredit(res.data.data);
      }
      setIsAddCustomerOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setInitialAmount('');
    } catch (err: any) {
      showToast(err.message || 'Failed to add customer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle You Gave
  const handleYouGaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredit) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/credits/give', {
        partyName: selectedCredit.partyName,
        phone: selectedCredit.phone,
        amount: num,
        remarks: remarks.trim() || 'Credit given from Cash Drawer',
      });

      showToast(`₹${num} recorded under You Gave (from Drawer)`, 'success');
      await refreshAccounts();
      await fetchCredits();
      setIsGiveModalOpen(false);
      setAmount('');
      setRemarks('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record entry', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle You Got
  const handleYouGotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredit) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post(`/credits/${selectedCredit._id}/repay`, {
        amount: num,
        remarks: remarks.trim() || 'Payment received into Cash Drawer',
      });

      showToast(`₹${num} recorded under You Got (into Drawer)!`, 'success');
      await refreshAccounts();
      await fetchCredits();
      setIsGotModalOpen(false);
      setAmount('');
      setRemarks('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record entry', 'error');
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
      {/* MIDDLE PANE: CUSTOMER MASTER LIST (Exact image layout)   */}
      {/* ======================================================== */}
      <div
        className={`w-full md:w-[420px] lg:w-[460px] flex-shrink-0 flex flex-col h-full border-r border-slate-200 bg-white ${
          selectedCredit ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Tabs (Customers vs Suppliers) */}
        <div className="flex items-center px-5 pt-3.5 border-b border-slate-200 gap-6">
          <button className="pb-2.5 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2">
            Customers <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{credits.length}</span>
          </button>
          <button
            onClick={() => navigate('/payables')}
            className="pb-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
          >
            Suppliers
          </button>
        </div>

        {/* Top Cumulative Summary Row */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs sm:text-sm gap-2">
          <div>
            <span className="text-slate-500 font-medium">You'll Give:</span>{' '}
            <span className="font-mono font-bold text-emerald-600 text-sm sm:text-base">₹0 ↗</span>
          </div>

          <div>
            <span className="text-slate-500 font-medium">You'll Get:</span>{' '}
            <span className="font-mono font-black text-rose-600 text-sm sm:text-base">
              ₹{totalYouWillGet.toLocaleString('en-IN')} ↙
            </span>
          </div>

          <button
            onClick={() => window.print()}
            className="text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50/80 hover:bg-blue-100 px-2.5 sm:px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> View Report
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-3.5 border-b border-slate-200 space-y-3 bg-white">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Search for customers
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
                <option value="ALL">All Customers</option>
                <option value="DUE">You'll Get (Due)</option>
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

        {/* Customer Table List Header */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span>NAME</span>
          <span>AMOUNT</span>
        </div>

        {/* Customer Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <LoadingSpinner message="Loading customer book..." />
          ) : filteredCredits.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No customers found. Click <strong>+ Add Customer</strong> below.
            </div>
          ) : (
            filteredCredits.map((c) => {
              const isSelected = selectedCredit?._id === c._id;
              const avatarClass = getAvatarColor(c.partyName);
              const initial = c.partyName.charAt(0).toUpperCase();

              return (
                <div
                  key={c._id}
                  onClick={() => setSelectedCredit(c)}
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
                        {c.partyName}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(c.updatedAt || c.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-mono font-bold ${
                        c.balanceDue > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    >
                      ₹{c.balanceDue.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {c.balanceDue > 0 ? "YOU'LL GET" : 'SETTLED'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Button Bar: + Add Customer */}
        <div className="p-3.5 border-t border-slate-200 bg-white">
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Add Customer
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT PANE: DETAIL LEDGER STREAM                         */}
      {/* ======================================================== */}
      <div
        className={`flex-1 flex flex-col h-full bg-white overflow-hidden ${
          selectedCredit ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedCredit ? (
          <>
            {/* Top Customer Bar */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedCredit(null)}
                    className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg -ml-1 flex-shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full font-bold text-sm sm:text-base flex items-center justify-center flex-shrink-0 ${getAvatarColor(
                      selectedCredit.partyName
                    )}`}
                  >
                    {selectedCredit.partyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                      {selectedCredit.partyName}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                      {selectedCredit.phone || 'No phone number'}
                    </p>
                  </div>
                </div>

                {/* Mobile Report Button */}
                <button
                  onClick={() => window.print()}
                  className="sm:hidden text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors flex-shrink-0"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" /> Report
                </button>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5">
                <button
                  onClick={() => window.print()}
                  className="hidden sm:flex text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-lg items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-4 h-4 text-slate-500" /> Report
                </button>

                <div className="w-full sm:w-auto text-right bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none sm:border-l sm:border-slate-200 sm:pl-5 flex sm:block items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    NET BALANCE:
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono text-emerald-600">
                    You'll Get: ₹{selectedCredit.balanceDue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Table Header (Desktop only) */}
            <div className="hidden sm:flex px-6 py-3 bg-slate-50/80 border-b border-slate-200 items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>ENTRIES</span>
              <div className="flex items-center gap-16 pr-4">
                <span className="w-20 text-right">YOU GAVE</span>
                <span className="w-20 text-right">YOU GOT</span>
                <span className="w-8 text-center">EDIT</span>
              </div>
            </div>

            {/* Entries Stream */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-4 sm:px-6 py-3 sm:py-0 space-y-3 sm:space-y-0">
              {selectedCredit.entries && selectedCredit.entries.length > 0 ? (
                [...selectedCredit.entries].reverse().map((entry, idx) => {
                  const isDeleted = !!entry.isDeleted;
                  return (
                    <React.Fragment key={entry._id || idx}>
                      {/* Mobile Card Layout (< sm) */}
                      <div
                        className={`sm:hidden p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                          isDeleted
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-xs font-bold font-mono ${
                                  isDeleted
                                    ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                    : 'text-slate-800'
                                }`}
                              >
                                {formatEntryDateTime(entry.date, (entry as any).createdAt, (entry as any)._id)}
                              </span>
                              {entry.isReconciled && !isDeleted && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300 uppercase tracking-wider shadow-2xs"
                                  title="Reconciled in Daily Closing. Editing and deleting are locked."
                                >
                                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                                  Locked
                                </span>
                              )}
                              {isDeleted && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 uppercase tracking-wider shadow-2xs">
                                  DELETED
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Balance: ₹{selectedCredit.balanceDue.toLocaleString('en-IN')}
                            </p>
                            <p
                              className={`text-xs mt-1 font-medium ${
                                isDeleted
                                  ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                  : 'text-slate-600'
                              }`}
                            >
                              {entry.remarks ||
                                (entry.type === CreditTransactionType.GIVEN ? 'Credit item' : 'Payment')}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!isDeleted ? (
                              entry.isReconciled ? (
                                <span
                                  className="p-1.5 text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed inline-flex items-center"
                                  title="Locked: Reconciled in Daily Closing. Cannot edit or delete."
                                >
                                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntry(entry)}
                                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit this entry"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCreditEntry(entry)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete this entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-xs font-bold">
                            {entry.type === CreditTransactionType.GIVEN ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                                YOU GAVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                YOU GOT
                              </span>
                            )}
                          </span>
                          <span
                            className={`font-mono font-black text-base ${
                              isDeleted
                                ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                : entry.type === CreditTransactionType.GIVEN
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            ₹{entry.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Desktop Row Layout (>= sm) */}
                      <div
                        className={`hidden sm:flex py-3.5 items-center justify-between transition-colors ${
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
                              {formatEntryDateTime(entry.date, (entry as any).createdAt, (entry as any)._id)}
                            </p>
                            {entry.isReconciled && !isDeleted && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300 uppercase tracking-wider shadow-2xs"
                                title="Reconciled in Daily Closing. Editing and deleting are locked."
                              >
                                <Lock className="w-2.5 h-2.5 text-slate-400" />
                                Reconciled
                              </span>
                            )}
                            {isDeleted && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 uppercase tracking-wider shadow-2xs">
                                DELETED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Balance: ₹{selectedCredit.balanceDue.toLocaleString('en-IN')}
                          </p>
                          <p
                            className={`text-sm mt-1 font-medium ${
                              isDeleted
                                ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                : 'text-slate-600'
                            }`}
                          >
                            {entry.remarks ||
                              (entry.type === CreditTransactionType.GIVEN ? 'Credit item' : 'Payment')}
                          </p>
                        </div>

                        <div className="flex items-center gap-8 sm:gap-14 pr-4">
                          {/* YOU GAVE */}
                          <div className="w-20 text-right font-mono font-bold text-sm">
                            {entry.type === CreditTransactionType.GIVEN ? (
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

                          {/* YOU GOT */}
                          <div className="w-20 text-right font-mono font-bold text-sm">
                            {entry.type === CreditTransactionType.REPAYMENT ? (
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
                              entry.isReconciled ? (
                                <span
                                  className="p-1.5 text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed inline-flex items-center"
                                  title="Locked: Reconciled in Daily Closing. Cannot edit or delete."
                                >
                                  <Lock className="w-4 h-4 text-slate-400" />
                                </span>
                              ) : (
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
                                    onClick={() => handleDeleteCreditEntry(entry)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete this entry"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )
                            ) : (
                              <span className="text-[11px] text-slate-300 font-semibold">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              ) : (
                <div className="py-24 text-center text-sm text-slate-400">
                  No entries recorded yet. Click <strong>You Gave ₹</strong> or <strong>You Got ₹</strong> below.
                </div>
              )}
            </div>

            {/* Bottom Action Buttons */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 max-w-lg mx-auto">
                <button
                  onClick={() => {
                    setAmount('');
                    setRemarks('');
                    setIsGiveModalOpen(true);
                  }}
                  className="py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] font-bold text-sm sm:text-base transition-colors shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  You Gave ₹
                </button>

                <button
                  onClick={() => {
                    setAmount('');
                    setRemarks('');
                    setIsGotModalOpen(true);
                  }}
                  className="py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#16a34a] font-bold text-sm sm:text-base transition-colors shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  You Got ₹
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <p className="text-base font-semibold">Select a customer from the list to view their ledger</p>
          </div>
        )}
      </div>

      {/* Modal: Add Customer */}
      <Modal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        title="Add New Customer"
        subtitle="Customer will appear in your ledger list"
      >
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <Input
            label="Customer Name"
            placeholder="e.g. Fousiya"
            value={newCustName}
            onChange={(e) => setNewCustName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="e.g. 9633565414"
            value={newCustPhone}
            onChange={(e) => setNewCustPhone(e.target.value)}
          />

          <Input
            label="Opening Amount (Optional)"
            type="number"
            prefixText="₹"
            placeholder="0.00"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            min="0"
            step="any"
          />



          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddCustomerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" isLoading={submitting}>
              Add Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: You Gave ₹ */}
      {selectedCredit && (
        <Modal
          isOpen={isGiveModalOpen}
          onClose={() => setIsGiveModalOpen(false)}
          title={`You Gave ₹ to ${selectedCredit.partyName}`}
          subtitle="Money or goods given on credit"
        >
          <form onSubmit={handleYouGaveSubmit} className="space-y-4">
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
              label="Description / Remarks (Optional)"
              placeholder="e.g. Pvc, print, copy"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsGiveModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" className="flex-1" isLoading={submitting}>
                Save (You Gave)
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: You Got ₹ */}
      {selectedCredit && (
        <Modal
          isOpen={isGotModalOpen}
          onClose={() => setIsGotModalOpen(false)}
          title={`You Got ₹ from ${selectedCredit.partyName}`}
          subtitle="Payment received from customer"
        >
          <form onSubmit={handleYouGotSubmit} className="space-y-4">
            <Input
              label="Amount Received"
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
              label="Description / Remarks (Optional)"
              placeholder="e.g. Cash received / GPay"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsGotModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="success" className="flex-1" isLoading={submitting}>
                Save (You Got)
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Edit Entry */}
      {selectedCredit && (
        <EditCreditEntryModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          creditId={selectedCredit._id}
          entry={editingEntry}
          partyName={selectedCredit.partyName}
          onSuccess={async () => {
            await fetchCredits();
          }}
        />
      )}
    </div>
  );
};
