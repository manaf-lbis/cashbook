import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard as CardIcon,
  Search,
  FileText,
  ArrowLeft,
  Plus,
  Edit3,
} from 'lucide-react';
import { apiClient, formatINR, formatDate, formatDateTime } from '../../api/client';
import { ICreditCard, ICreditCardTransaction, CreditCardTransactionType, ApiResponse } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAccounts } from '../../context/AccountContext';
import { EditCardTransactionModal } from './components/EditCardTransactionModal';

const CARD_AVATARS = [
  'bg-indigo-100 text-indigo-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-purple-100 text-purple-800',
];

export const CreditCardsPage: React.FC = () => {
  const { showToast } = useToast();
  const { accounts, refreshAccounts } = useAccounts();
  const [cards, setCards] = useState<ICreditCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Search, Filter, Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [sortBy, setSortBy] = useState('RECENT');

  // Selected card
  const [selectedCard, setSelectedCard] = useState<ICreditCard | null>(null);
  const [transactions, setTransactions] = useState<ICreditCardTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Modals
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [isDrawnModalOpen, setIsDrawnModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<ICreditCardTransaction | null>(null);
  const [showDrawnOptions, setShowDrawnOptions] = useState(false);
  const [showPayOptions, setShowPayOptions] = useState(false);

  // Form states
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add Card form
  const [cardName, setCardName] = useState('');
  const [bankName, setBankName] = useState('');
  const [last4Digits, setLast4Digits] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<ApiResponse<ICreditCard[]>>('/credit-cards');
      if (res.data.success) {
        setCards(res.data.data);
        if (res.data.data.length > 0 && !selectedCard) {
          setSelectedCard(res.data.data[0]);
        } else if (selectedCard) {
          const updated = res.data.data.find((c) => c._id === selectedCard._id);
          if (updated) setSelectedCard(updated);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load credit cards', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedCard?._id]);

  const fetchTransactions = useCallback(async (cardId: string) => {
    try {
      setLoadingTx(true);
      const res = await apiClient.get<ApiResponse<ICreditCardTransaction[]>>(`/credit-cards/${cardId}/transactions`);
      if (res.data.success) {
        setTransactions(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load card txs:', err);
    } finally {
      setLoadingTx(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    if (selectedCard) {
      fetchTransactions(selectedCard._id);
    }
  }, [selectedCard, fetchTransactions]);

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0]._id);
    }
  }, [accounts, accountId]);

  // Totals
  const totalDebt = cards.reduce((sum, c) => sum + c.totalOutstanding, 0);
  const totalAvailable = cards.reduce((sum, c) => sum + c.availableLimit, 0);

  // Filter & Sort
  const filteredCards = cards
    .filter((c) => {
      if (filterType === 'WITH_DEBT') return c.totalOutstanding > 0;
      if (filterType === 'CLEAR') return c.totalOutstanding <= 0;
      return true;
    })
    .filter(
      (c) =>
        c.cardName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.last4Digits.includes(searchQuery)
    )
    .sort((a, b) => {
      if (sortBy === 'DEBT_HIGH') return b.totalOutstanding - a.totalOutstanding;
      if (sortBy === 'LIMIT_HIGH') return b.creditLimit - a.creditLimit;
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  // Handle Add Card
  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const numLimit = parseFloat(creditLimit);
    if (isNaN(numLimit) || numLimit <= 0) {
      showToast('Please enter a valid credit limit', 'error');
      return;
    }
    if (last4Digits.length !== 4) {
      showToast('Last 4 digits must be 4 numbers', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient.post<ApiResponse<ICreditCard>>('/credit-cards', {
        cardName: cardName.trim(),
        bankName: bankName.trim(),
        last4Digits,
        creditLimit: numLimit,
      });

      showToast(`Credit Card "${cardName}" added!`, 'success');
      await fetchCards();
      if (res.data.data) {
        setSelectedCard(res.data.data);
      }
      setIsAddCardOpen(false);
      setCardName('');
      setBankName('');
      setLast4Digits('');
      setCreditLimit('');
    } catch (err: any) {
      showToast(err.message || 'Failed to add card', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Cash Drawn
  const handleCashDrawnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/credit-cards/transaction', {
        cardId: selectedCard._id,
        type: CreditCardTransactionType.CASH_DRAWN,
        amount: num,
        depositToAccountId: accountId || undefined,
        remarks: remarks.trim() || undefined,
        description: remarks.trim() || undefined,
      });

      showToast(`₹${num} drawn on card ${selectedCard.cardName}`, 'success');
      await refreshAccounts();
      await fetchCards();
      if (selectedCard) fetchTransactions(selectedCard._id);
      setIsDrawnModalOpen(false);
      setAmount('');
      setRemarks('');
      setShowDrawnOptions(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to record entry', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Pay Bill
  const handlePayBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/credit-cards/transaction', {
        cardId: selectedCard._id,
        type: CreditCardTransactionType.PAYMENT,
        amount: num,
        paidFromAccountId: accountId || undefined,
        remarks: remarks.trim() || undefined,
        description: remarks.trim() || undefined,
      });

      showToast(`₹${num} bill payment paid for ${selectedCard.cardName}!`, 'success');
      await refreshAccounts();
      await fetchCards();
      if (selectedCard) fetchTransactions(selectedCard._id);
      setIsPayModalOpen(false);
      setAmount('');
      setRemarks('');
      setShowPayOptions(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to pay bill', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const accountOptions = [
    { value: '', label: 'None (Direct Card Transaction)' },
    ...accounts.map((acc) => ({
      value: acc._id,
      label: `${acc.name} (${acc.type}) - Balance: ₹${acc.balance.toLocaleString('en-IN')}`,
    })),
  ];

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CARD_AVATARS[Math.abs(hash) % CARD_AVATARS.length];
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white select-none">
      {/* ======================================================== */}
      {/* MIDDLE PANE: CREDIT CARDS MASTER LIST                    */}
      {/* ======================================================== */}
      <div
        className={`w-full md:w-[420px] lg:w-[460px] flex-shrink-0 flex flex-col h-full border-r border-slate-200 bg-white ${
          selectedCard ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center px-5 pt-3.5 border-b border-slate-200">
          <button className="pb-2.5 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2">
            Credit Cards <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{cards.length}</span>
          </button>
        </div>

        {/* Top Cumulative Summary Row */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs sm:text-sm gap-2">
          <div>
            <span className="text-slate-500 font-medium">Total Debt:</span>{' '}
            <span className="font-mono font-black text-rose-600 text-sm sm:text-base">
              ₹{totalDebt.toLocaleString('en-IN')} ↗
            </span>
          </div>

          <div>
            <span className="text-slate-500 font-medium">Available:</span>{' '}
            <span className="font-mono font-bold text-emerald-600 text-sm sm:text-base">
              ₹{totalAvailable.toLocaleString('en-IN')} ↙
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
              Search for credit cards
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Card Name or Bank"
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
                <option value="ALL">All Cards</option>
                <option value="WITH_DEBT">With Outstanding Debt</option>
                <option value="CLEAR">Clear Debt (₹0)</option>
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
                <option value="DEBT_HIGH">Debt: High to Low</option>
                <option value="LIMIT_HIGH">Limit: High to Low</option>
                <option value="NAME">Name: A to Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card Table Header */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span>CARD NAME</span>
          <span>OUTSTANDING</span>
        </div>

        {/* Cards List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <LoadingSpinner message="Loading credit cards..." />
          ) : filteredCards.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No credit cards found. Click <strong>+ Add Credit Card</strong> below.
            </div>
          ) : (
            filteredCards.map((card) => {
              const isSelected = selectedCard?._id === card._id;
              const avatarClass = getAvatarColor(card.cardName);

              return (
                <div
                  key={card._id}
                  onClick={() => setSelectedCard(card)}
                  className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center flex-shrink-0 ${avatarClass}`}
                    >
                      <CardIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {card.cardName}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        {card.bankName} •••• {card.last4Digits}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-rose-600">
                      ₹{card.totalOutstanding.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      LIMIT: ₹{card.creditLimit.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Button Bar */}
        <div className="p-3.5 border-t border-slate-200 bg-white">
          <button
            onClick={() => setIsAddCardOpen(true)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Add Credit Card
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT PANE: DETAIL STATEMENT STREAM                      */}
      {/* ======================================================== */}
      <div
        className={`flex-1 flex flex-col h-full bg-white overflow-hidden ${
          selectedCard ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedCard ? (
          <>
            {/* Top Card Bar */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedCard(null)}
                    className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg -ml-1 flex-shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full font-bold text-sm sm:text-base flex items-center justify-center flex-shrink-0 ${getAvatarColor(
                      selectedCard.cardName
                    )}`}
                  >
                    <CardIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                      {selectedCard.cardName}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                      {selectedCard.bankName} • Ending {selectedCard.last4Digits}
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
                    CARD DEBT:
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono text-rose-600">
                    You'll Pay: ₹{selectedCard.totalOutstanding.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Table Header (Desktop only) */}
            <div className="hidden sm:flex px-6 py-3 bg-slate-50/80 border-b border-slate-200 items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>ENTRIES</span>
              <div className="flex items-center gap-12 pr-2">
                <span className="w-28 text-right">CASH DRAWN / SWIPE</span>
                <span className="w-28 text-right">BILL PAID</span>
                <span className="w-8 text-center">EDIT</span>
              </div>
            </div>

            {/* Entries Stream */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-4 sm:px-6 py-3 sm:py-0 space-y-3 sm:space-y-0">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <React.Fragment key={tx._id}>
                    {/* Mobile Card Layout (< sm) */}
                    <div className="sm:hidden p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2.5 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 font-mono">
                            {formatDateTime(tx.date)}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Card Balance: ₹{tx.balanceAfter.toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-slate-600 mt-1 font-medium">
                            {tx.remarks ||
                              (tx.type === CreditCardTransactionType.PAYMENT
                                ? 'Bill Payment'
                                : 'Cash Drawn / Purchase')}
                          </p>
                        </div>

                        <div className="flex items-center flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingTx(tx)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit this entry"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs font-bold">
                          {tx.type !== CreditCardTransactionType.PAYMENT ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                              DRAWN / SWIPE
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                              BILL PAID
                            </span>
                          )}
                        </span>
                        <span
                          className={`font-mono font-black text-base ${
                            tx.type !== CreditCardTransactionType.PAYMENT
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          ₹{tx.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Desktop Row Layout (>= sm) */}
                    <div className="hidden sm:flex py-3.5 items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-slate-800 font-mono">
                          {formatDateTime(tx.date)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Card Balance: ₹{tx.balanceAfter.toLocaleString('en-IN')}
                        </p>
                        <p className="text-sm text-slate-600 mt-1 font-medium">
                          {tx.remarks || (tx.type === CreditCardTransactionType.PAYMENT ? 'Bill Payment' : 'Cash Drawn / Purchase')}
                        </p>
                      </div>

                      <div className="flex items-center gap-12 pr-2">
                        {/* DRAWN / SWIPE */}
                        <div className="w-28 text-right font-mono font-bold text-sm">
                          {tx.type !== CreditCardTransactionType.PAYMENT ? (
                            <span className="text-rose-600">₹{tx.amount.toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>

                        {/* BILL PAID */}
                        <div className="w-28 text-right font-mono font-bold text-sm">
                          {tx.type === CreditCardTransactionType.PAYMENT ? (
                            <span className="text-emerald-600">₹{tx.amount.toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>

                        {/* EDIT ACTION */}
                        <div className="w-8 flex justify-center">
                          <button
                            type="button"
                            onClick={() => setEditingTx(tx)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit this entry"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                ))
              ) : (
                <div className="py-24 text-center text-sm text-slate-400">
                  No card entries recorded yet. Click <strong>Cash Drawn / Swipe ₹</strong> or <strong>Pay Card Bill ₹</strong> below.
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
                    setIsDrawnModalOpen(true);
                  }}
                  className="py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] font-bold text-sm sm:text-base transition-colors shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  Cash Drawn / Swipe ₹
                </button>

                <button
                  onClick={() => {
                    setAmount('');
                    setRemarks('');
                    setIsPayModalOpen(true);
                  }}
                  className="py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#16a34a] font-bold text-sm sm:text-base transition-colors shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  Pay Card Bill ₹
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <p className="text-base font-semibold">Select a card from the list to view statement</p>
          </div>
        )}
      </div>

      {/* Modal: Add Card */}
      <Modal
        isOpen={isAddCardOpen}
        onClose={() => setIsAddCardOpen(false)}
        title="Add New Credit Card"
        subtitle="Track card debit, credit, and cash withdrawals"
      >
        <form onSubmit={handleAddCard} className="space-y-4">
          <Input
            label="Card Nickname"
            placeholder="e.g. HDFC Regalia"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Bank / Issuer"
              placeholder="e.g. HDFC Bank"
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
            placeholder="0.00"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            required
            min="1"
            step="any"
          />

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddCardOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" isLoading={submitting}>
              Save Card
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Cash Drawn / Swipe */}
      {selectedCard && (
        <Modal
          isOpen={isDrawnModalOpen}
          onClose={() => setIsDrawnModalOpen(false)}
          title={`Cash Drawn / Swipe on ${selectedCard.cardName}`}
          subtitle="Increases card debt"
        >
          <form onSubmit={handleCashDrawnSubmit} className="space-y-4">
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
              label="Description"
              placeholder="e.g. ATM withdrawal / Shop purchase"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />

            {/* Optional Account Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDrawnOptions(!showDrawnOptions)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                {showDrawnOptions ? '▲ Hide Deposit Account' : '▼ More Options: Deposit to Cash/Bank Account'}
              </button>

              {showDrawnOptions && (
                <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <Select
                    label="Deposit Drawn Cash Into (Optional)"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    options={accountOptions}
                    helperText="Depositing in Cash in Hand adds funds to your counter drawer."
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDrawnModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" className="flex-1" isLoading={submitting}>
                Save Transaction
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Pay Bill */}
      {selectedCard && (
        <Modal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          title={`Pay Bill for ${selectedCard.cardName}`}
          subtitle="Settles card debt and reduces outstanding balance"
        >
          <form onSubmit={handlePayBillSubmit} className="space-y-4">
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
              max={selectedCard.totalOutstanding}
              step="any"
            />
            <Input
              label="Description"
              placeholder="e.g. Card bill settlement"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />

            {/* Optional Account Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowPayOptions(!showPayOptions)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                {showPayOptions ? '▲ Hide Payment Account' : '▼ More Options: Paid From Account'}
              </button>

              {showPayOptions && (
                <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <Select
                    label="Paid From (Account) (Optional)"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    options={accountOptions}
                    helperText="Funds will be deducted from this account and reduce card debt."
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsPayModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="success" className="flex-1" isLoading={submitting}>
                Pay Bill
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Edit Card Transaction */}
      {selectedCard && (
        <EditCardTransactionModal
          isOpen={!!editingTx}
          onClose={() => setEditingTx(null)}
          transaction={editingTx}
          cardName={selectedCard.cardName}
          onSuccess={async () => {
            await fetchCards();
            if (selectedCard) {
              await fetchTransactions(selectedCard._id);
            }
          }}
        />
      )}
    </div>
  );
};
