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
} from 'lucide-react';
import { apiClient, formatINR, formatDate, formatDateTime } from '../../api/client';
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
    if (numAmount > 0 && !accountId) {
      showToast('Please select payment account', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient.post<ApiResponse<ICredit>>('/credits/give', {
        partyName: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        amount: numAmount > 0 ? numAmount : 0.01,
        accountId: numAmount > 0 ? accountId : accounts[0]?._id,
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
        accountId,
        remarks: remarks.trim() || 'Credit given',
      });

      showToast(`₹${num} recorded under You Gave`, 'success');
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
        accountId,
        remarks: remarks.trim() || 'Payment received',
      });

      showToast(`₹${num} recorded under You Got!`, 'success');
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
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between text-sm">
          <div>
            <span className="text-slate-500 font-medium">You'll Give:</span>{' '}
            <span className="font-mono font-bold text-emerald-600 text-base">₹0 ↗</span>
          </div>

          <div>
            <span className="text-slate-500 font-medium">You'll Get:</span>{' '}
            <span className="font-mono font-black text-rose-600 text-base">
              ₹{totalYouWillGet.toLocaleString('en-IN')} ↙
            </span>
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
      {/* RIGHT PANE: DETAIL LEDGER STREAM (Exact image layout)   */}
      {/* ======================================================== */}
      <div
        className={`flex-1 flex flex-col h-full bg-white overflow-hidden ${
          selectedCredit ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedCredit ? (
          <>
            {/* Top Customer Bar */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => setSelectedCredit(null)}
                  className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg -ml-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div
                  className={`w-11 h-11 rounded-full font-bold text-base flex items-center justify-center ${getAvatarColor(
                    selectedCredit.partyName
                  )}`}
                >
                  {selectedCredit.partyName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {selectedCredit.partyName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {selectedCredit.phone || 'No phone number'}
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
                  <span className="text-base font-black font-mono text-emerald-600">
                    You'll Get: ₹{selectedCredit.balanceDue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Table Header */}
            <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>ENTRIES</span>
              <div className="flex items-center gap-16 pr-4">
                <span className="w-20 text-right">YOU GAVE</span>
                <span className="w-20 text-right">YOU GOT</span>
                <span className="w-8 text-center">EDIT</span>
              </div>
            </div>

            {/* Entries Stream */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-6">
              {selectedCredit.entries && selectedCredit.entries.length > 0 ? (
                [...selectedCredit.entries].reverse().map((entry, idx) => (
                  <div
                    key={entry._id || idx}
                    className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800 font-mono">
                        {formatDateTime(entry.date)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Balance: ₹{selectedCredit.balanceDue.toLocaleString('en-IN')}
                      </p>
                      <p className="text-sm text-slate-600 mt-1 font-medium">
                        {entry.remarks || (entry.type === CreditTransactionType.GIVEN ? 'Credit item' : 'Payment')}
                      </p>
                    </div>

                    <div className="flex items-center gap-16 pr-4">
                      {/* YOU GAVE */}
                      <div className="w-20 text-right font-mono font-bold text-sm">
                        {entry.type === CreditTransactionType.GIVEN ? (
                          <span className="text-rose-600">₹{entry.amount.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </div>

                      {/* YOU GOT */}
                      <div className="w-20 text-right font-mono font-bold text-sm">
                        {entry.type === CreditTransactionType.REPAYMENT ? (
                          <span className="text-emerald-600">₹{entry.amount.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </div>

                      {/* Edit Action */}
                      <div className="w-8 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit this entry"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-24 text-center text-sm text-slate-400">
                  No entries recorded yet. Click <strong>You Gave ₹</strong> or <strong>You Got ₹</strong> below.
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
                    setIsGiveModalOpen(true);
                  }}
                  className="py-3.5 px-4 rounded-xl bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] font-bold text-base transition-colors shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  You Gave ₹
                </button>

                <button
                  onClick={() => {
                    setAmount('');
                    setRemarks('');
                    setIsGotModalOpen(true);
                  }}
                  className="py-3.5 px-4 rounded-xl bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#16a34a] font-bold text-base transition-colors shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
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

          {initialAmount && parseFloat(initialAmount) > 0 && (
            <Select
              label="Disbursed From (Account)"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={accountOptions}
            />
          )}

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
            <Select
              label="Paid From (Account)"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={accountOptions}
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
            <Select
              label="Deposit In (Account)"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={accountOptions}
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
