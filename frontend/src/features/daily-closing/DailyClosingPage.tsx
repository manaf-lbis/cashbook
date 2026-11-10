import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Users,
  CreditCard,
  Wallet,
  Building2,
  Scale,
  Sparkles,
  Clock,
  History,
  Edit2,
  Check,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { apiClient, formatINR, formatDate, getLocalDateString, addDaysToDateString } from '../../api/client';
import {
  IDailyClosingSummary,
  IManualCashSplitUp,
  ApiResponse,
} from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { DetailedHistoryView } from './components/DetailedHistoryView';

export const DailyClosingPage: React.FC = () => {
  const { showToast } = useToast();

  // Active top-level view: 'RECONCILE' or 'HISTORY'
  const [activeTab, setActiveTab] = useState<'RECONCILE' | 'HISTORY'>('RECONCILE');

  // Current selected date (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getLocalDateString();
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<IDailyClosingSummary | null>(null);

  // Form states
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [manualSplitUps, setManualSplitUps] = useState<IManualCashSplitUp[]>([]);
  const [notes, setNotes] = useState<string>('');

  // After-closing night activity modal state
  const [isMarkingAfterClosing, setIsMarkingAfterClosing] = useState(false);
  const [adjType, setAdjType] = useState<'EXPENSE' | 'COLLECTION'>('EXPENSE');
  const [adjTitle, setAdjTitle] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjCategory, setAdjCategory] = useState('General');
  const [savingAdj, setSavingAdj] = useState(false);

  // Customizable Quick Add Presets State (Persisted in localStorage)
  const [quickPresets, setQuickPresets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cashbook_quick_presets');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return ['Fedbank', 'SBI', 'CSC Wallet', 'Counter Cash Drawer'];
  });
  const [isAddingCustomPreset, setIsAddingCustomPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [saveForLater, setSaveForLater] = useState(true);

  // Fetch live summary for selected date
  const fetchSummary = useCallback(
    async (dateStr: string, preserveReset = false) => {
      try {
        setLoading(true);
        const res = await apiClient.get<ApiResponse<IDailyClosingSummary>>(
          `/daily-closing/summary?date=${dateStr}`
        );
        if (res.data.success && res.data.data) {
          const data = res.data.data;
          setSummary(data);
          setOpeningBalance(data.openingBalance);

          if (!preserveReset) {
            // Counted input fields: initialize cleanly with 0 or saved if already closed
            const initialSplitUps = data.existingClosing?.manualSplitUps?.length
              ? data.existingClosing.manualSplitUps.map((s) => ({
                  sourceName: s.sourceName,
                  amount: data.isAlreadyClosed ? s.amount : 0,
                  notes: s.notes,
                }))
              : data.defaultSplitUps?.map((s) => ({ ...s, amount: 0 })) || [
                  { sourceName: 'Cash Drawer', amount: 0 },
                ];
            setManualSplitUps(initialSplitUps);
            setNotes(data.existingClosing?.notes || '');
          }
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to load day summary', 'error');
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchSummary(selectedDate);
  }, [selectedDate, fetchSummary]);

  // Date Navigation
  const changeDateBy = (days: number) => {
    setSelectedDate((prev) => addDaysToDateString(prev, days));
  };

  const setDateToToday = () => {
    setSelectedDate(getLocalDateString());
  };

  // Numbers from books
  const dayBookSales = summary?.dayBook?.totalSales || 0;
  const customerNet = summary?.customerBook?.customerNet || 0;
  const expenseTotal = summary?.expenseBook?.totalExpenses || 0;
  const creditCardNet = summary?.creditCardBook?.creditCardNet || 0;

  // Expected Closing = Opening + Daybook + Customer - Expense + Credit Card
  const expectedClosingBalance = useMemo(() => {
    return openingBalance + dayBookSales + customerNet - expenseTotal + creditCardNet;
  }, [openingBalance, dayBookSales, customerNet, expenseTotal, creditCardNet]);

  // Actual Counted Cash across all split-ups
  const actualClosingBalance = useMemo(() => {
    return manualSplitUps.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [manualSplitUps]);

  // Variance: Actual - Expected
  const variance = useMemo(() => {
    return actualClosingBalance - expectedClosingBalance;
  }, [actualClosingBalance, expectedClosingBalance]);

  const isBalanced = Math.abs(variance) < 0.01;

  // Split-up handlers
  const handleSplitUpChange = (index: number, field: keyof IManualCashSplitUp, value: any) => {
    const updated = [...manualSplitUps];
    updated[index] = {
      ...updated[index],
      [field]: field === 'amount' ? (value === '' ? 0 : parseFloat(value) || 0) : value,
    };
    setManualSplitUps(updated);
  };

  const addSplitUpRow = (sourceName = '') => {
    setManualSplitUps([...manualSplitUps, { sourceName, amount: 0 }]);
  };

  const removeSplitUpRow = (index: number) => {
    if (manualSplitUps.length <= 1) {
      showToast('Keep at least one cash / bank source', 'info');
      return;
    }
    setManualSplitUps(manualSplitUps.filter((_, i) => i !== index));
  };

  const addQuickPreset = (name: string) => {
    const exists = manualSplitUps.some((item) => item.sourceName.toLowerCase() === name.toLowerCase());
    if (exists) {
      showToast(`"${name}" is already in your count list`, 'info');
      return;
    }
    addSplitUpRow(name);
  };

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPresetName.trim();
    if (!clean) return;

    // 1. Add to current count list immediately
    addQuickPreset(clean);

    // 2. If user checked "Save for later", persist into quick presets
    if (saveForLater) {
      if (!quickPresets.some((p) => p.toLowerCase() === clean.toLowerCase())) {
        const updated = [...quickPresets, clean];
        setQuickPresets(updated);
        localStorage.setItem('cashbook_quick_presets', JSON.stringify(updated));
        showToast(`"${clean}" saved to Quick Add area for later`, 'success');
      }
    } else {
      showToast(`"${clean}" added for today's count only`, 'info');
    }

    setNewPresetName('');
    setIsAddingCustomPreset(false);
  };

  const removeQuickPresetFromArea = (nameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = quickPresets.filter((p) => p !== nameToRemove);
    setQuickPresets(updated);
    localStorage.setItem('cashbook_quick_presets', JSON.stringify(updated));
    showToast(`Removed "${nameToRemove}" from Quick Add area`, 'info');
  };

  // Reset all counted input fields to zero
  const handleResetCountedCash = () => {
    setManualSplitUps((prev) => prev.map((s) => ({ ...s, amount: 0 })));
    showToast('Counted cash input fields reset to zero', 'info');
  };

  // Save Daily Closing
  const handleSaveClosing = async () => {
    const hasEmpty = manualSplitUps.some((s) => !s.sourceName.trim());
    if (hasEmpty) {
      showToast('Please name all cash/bank count fields', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        date: selectedDate,
        openingBalance,
        dayBookSales,
        customerNet,
        customerRepayments: summary?.customerBook?.totalRepayments || 0,
        customerCreditGiven: summary?.customerBook?.totalCreditGiven || 0,
        expenseTotal,
        creditCardNet,
        creditCardDrawn: summary?.creditCardBook?.creditCardDrawn || 0,
        creditCardPayment: summary?.creditCardBook?.creditCardPayment || 0,
        manualSplitUps,
        notes: notes.trim() || undefined,
      };

      const res = await apiClient.post<ApiResponse<any>>('/daily-closing', payload);
      if (res.data.success) {
        if (res.data.data.isBalanced) {
          showToast('✅ Day closing reconciled and saved with zero discrepancy!', 'success');
        } else {
          showToast(
            res.data.data.warningMessage || '⚠️ Day closing saved with discrepancy note',
            'warning'
          );
        }
        // RESET all counted input field cash after save!
        setManualSplitUps((prev) => prev.map((item) => ({ ...item, amount: 0 })));
        setNotes('');
        await fetchSummary(selectedDate, true /* preserveReset */);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save day closing', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Record an After-Closing Night Expense / Collection for Opening Reconciliation
  const handleSaveAfterClosingAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(adjAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    if (!adjTitle.trim()) {
      showToast('Please enter a description/reason', 'error');
      return;
    }

    try {
      setSavingAdj(true);
      const res = await apiClient.post('/daily-closing/after-closing-adjustment', {
        dateStr: selectedDate,
        type: adjType,
        title: adjTitle.trim(),
        amount: amt,
        category: adjCategory,
        remarks: 'After-closing adjustment for opening reconciliation',
      });
      if (res.data.success) {
        showToast(
          `✅ After-closing ${adjType.toLowerCase()} of ₹${amt.toLocaleString('en-IN')} recorded & reconciled!`,
          'success'
        );
        setIsMarkingAfterClosing(false);
        setAdjTitle('');
        setAdjAmount('');
        await fetchSummary(selectedDate);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record adjustment', 'error');
    } finally {
      setSavingAdj(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50/70">
      <div className="max-w-6xl mx-auto px-3.5 py-4 sm:px-6 sm:py-8 space-y-4 sm:space-y-6 pb-28">
        {/* Top Header & Tab Navigation */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                Day Opening & Closing
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Reconcile daily book ledgers and count your physical & bank cash.
              </p>
            </div>

            {/* View Switcher Tabs */}
            <div className="grid grid-cols-2 sm:flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('RECONCILE')}
                className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'RECONCILE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Scale className="w-4 h-4 text-blue-600" />
                Daily Register
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'HISTORY'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <History className="w-4 h-4 text-slate-600" />
                Closing History
              </button>
            </div>
          </div>
        </div>

        {/* Tab 2: Detailed History View */}
        {activeTab === 'HISTORY' ? (
          <DetailedHistoryView
            onSelectDate={(date) => {
              setSelectedDate(date);
              setActiveTab('RECONCILE');
            }}
          />
        ) : (
          /* Tab 1: Simple, Uncluttered Daily Reconcile View */
          <>
            {/* Date Navigator Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Date Navigation */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => changeDateBy(-1)}
                    className="p-1.5 hover:bg-white text-slate-600 rounded-lg transition-colors cursor-pointer"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 font-mono px-2 outline-none cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => changeDateBy(1)}
                    className="p-1.5 hover:bg-white text-slate-600 rounded-lg transition-colors cursor-pointer"
                    title="Next Day"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <Button variant="outline" size="sm" onClick={setDateToToday} className="text-xs font-semibold">
                  Today
                </Button>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                {summary?.isAlreadyClosed ? (
                  summary.existingClosing?.status === 'BALANCED' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Closed & Balanced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5" /> Closed with Discrepancy
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <Sparkles className="w-3.5 h-3.5" /> Open Day / Reconciling
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-24 flex justify-center">
                <LoadingSpinner message="Calculating day transactions..." />
              </div>
            ) : (
              <>
                {/* 2-Column Clean Layout: (1) System Ledgers vs (2) Counted Cash */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Left Column: System Ledgers (Automatic) */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-4 sm:space-y-5">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                            <Wallet className="w-4 h-4" />
                          </span>
                          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                            1. System Ledgers (Calculated)
                          </h3>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{formatDate(selectedDate)}</span>
                      </div>

                      {/* Opening Liquid Cash Reconciliation Box (Strictly Non-Editable) */}
                      <div className="mt-4 p-3.5 sm:p-4 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-slate-500" />
                              Starting Liquid Cash
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              System reconciled from yesterday's closing cash
                            </span>
                          </div>
                          <span className="text-lg sm:text-xl font-black font-mono text-slate-900">
                            ₹{openingBalance.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Reconciliation Sub-Breakdown */}
                        <div className="space-y-1.5 text-xs">
                          {/* 1. Base from Yesterday's Close */}
                          <div className="flex items-center justify-between text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              Yesterday's Counted Close:
                            </span>
                            <span className="font-mono font-bold text-slate-800">
                              ₹{(
                                summary?.previousClosingCountedCash ??
                                summary?.previousClosing?.actualClosingBalance ??
                                0
                              ).toLocaleString('en-IN')}
                            </span>
                          </div>

                          {/* 2. After-Closing Night Expenses */}
                          {(summary?.afterClosingActivity?.totalExpenses || 0) > 0 && (
                            <div className="flex items-center justify-between text-rose-700 bg-rose-50/70 p-2 rounded-lg border border-rose-100">
                              <span className="flex items-center gap-1.5 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                Night Expenses After Close (-):
                              </span>
                              <span className="font-mono font-bold">
                                -₹{(summary?.afterClosingActivity?.totalExpenses || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          )}

                          {/* 3. After-Closing Collections */}
                          {(summary?.afterClosingActivity?.totalCollections || 0) > 0 && (
                            <div className="flex items-center justify-between text-emerald-700 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                              <span className="flex items-center gap-1.5 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Night Collections (+):
                              </span>
                              <span className="font-mono font-bold">
                                +₹{(summary?.afterClosingActivity?.totalCollections || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Button to Mark Night Expense / Collection */}
                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">Night expense after closing?</span>
                          <button
                            type="button"
                            onClick={() => setIsMarkingAfterClosing(true)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Mark Night Expense
                          </button>
                        </div>
                      </div>

                      {/* Today's Transactions Simple List */}
                      <div className="mt-4 space-y-2.5">
                        {/* Daybook Sales */}
                        <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                              <Receipt className="w-4 h-4" />
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Daybook Sales</span>
                              <span className="text-[11px] text-slate-400">Total biller sales today</span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-sm text-emerald-600">
                            +₹{dayBookSales.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Customer Book */}
                        <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                              <Users className="w-4 h-4" />
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Customer Collections</span>
                              <span className="text-[11px] text-slate-400">Net customer cash received</span>
                            </div>
                          </div>
                          <span
                            className={`font-mono font-bold text-sm ${
                              customerNet >= 0 ? 'text-blue-600' : 'text-amber-600'
                            }`}
                          >
                            {customerNet >= 0 ? '+' : ''}₹{customerNet.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Expenses */}
                        <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                              <Receipt className="w-4 h-4" />
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Shop Expenses</span>
                              <span className="text-[11px] text-slate-400">Recorded expenses today</span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-sm text-rose-600">
                            -₹{expenseTotal.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Credit Cards */}
                        <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                              <CreditCard className="w-4 h-4" />
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Credit Card Activity</span>
                              <span className="text-[11px] text-slate-400">Cash drawn / swipes vs bill paid</span>
                            </div>
                          </div>
                          <span
                            className={`font-mono font-bold text-sm ${
                              creditCardNet >= 0 ? 'text-purple-600' : 'text-slate-600'
                            }`}
                          >
                            {creditCardNet >= 0 ? '+' : ''}₹{creditCardNet.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Total Expected Closing Box */}
                    <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between mt-4">
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Expected Balance</span>
                        <span className="text-xs text-slate-500">Starting cash + Net today</span>
                      </div>
                      <span className="text-xl font-black font-mono text-white">
                        ₹{expectedClosingBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Actual Counted Cash (Manual Split-Up) */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Building2 className="w-4 h-4" />
                          </span>
                          <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                            2. Counted Cash & Banks (Manual)
                          </h3>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">Physical & Digital Count</span>
                      </div>

                      {/* Quick Add Presets (Customizable with Save for Later / One-Time) */}
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                            Quick Add Area
                          </span>
                          {!isAddingCustomPreset && (
                            <button
                              type="button"
                              onClick={() => setIsAddingCustomPreset(true)}
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Customize
                            </button>
                          )}
                        </div>

                        {/* Inline Add Preset Popover / Form */}
                        {isAddingCustomPreset && (
                          <form
                            onSubmit={handleCreatePreset}
                            className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2.5 animate-in fade-in duration-150"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-blue-900">Add Account / Cash Source</span>
                              <button
                                type="button"
                                onClick={() => setIsAddingCustomPreset(false)}
                                className="text-slate-400 hover:text-slate-600 p-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5 hidden" />
                                <span className="text-xs font-bold">&times;</span>
                              </button>
                            </div>

                            <input
                              type="text"
                              autoFocus
                              placeholder="e.g. Canara Bank, Petty Cash..."
                              value={newPresetName}
                              onChange={(e) => setNewPresetName(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-white border border-blue-200 rounded-lg outline-none focus:border-blue-500 font-semibold"
                            />

                            <div className="flex items-center justify-between text-xs">
                              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
                                <input
                                  type="checkbox"
                                  checked={saveForLater}
                                  onChange={(e) => setSaveForLater(e.target.checked)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Save to Quick Add for later</span>
                              </label>

                              <button
                                type="submit"
                                disabled={!newPresetName.trim()}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                              >
                                Add
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Preset Chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {quickPresets.map((preset) => (
                            <div
                              key={preset}
                              className="group inline-flex items-center bg-slate-100 hover:bg-slate-200/90 text-slate-700 rounded-lg text-xs font-semibold pl-2.5 pr-1 py-1 transition-colors shadow-2xs"
                            >
                              <button
                                type="button"
                                onClick={() => addQuickPreset(preset)}
                                className="cursor-pointer hover:text-blue-600 mr-1.5"
                                title={`Add "${preset}" to today's count`}
                              >
                                + {preset}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => removeQuickPresetFromArea(preset, e)}
                                className="opacity-40 group-hover:opacity-100 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-opacity"
                                title={`Remove "${preset}" from Quick Add area`}
                              >
                                &times;
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => setIsAddingCustomPreset(true)}
                            className="px-2 py-1 text-xs font-semibold border border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                            title="Add a custom account"
                          >
                            <Plus className="w-3 h-3" /> New
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Split-up Input Rows */}
                      <div className="mt-4 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {manualSplitUps.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80"
                          >
                            <input
                              type="text"
                              placeholder="Account / Cash name"
                              value={item.sourceName}
                              onChange={(e) => handleSplitUpChange(index, 'sourceName', e.target.value)}
                              className="flex-1 min-w-0 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                            />

                            <div className="relative w-28 sm:w-36 shrink-0">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={item.amount === 0 ? '' : item.amount}
                                onChange={(e) => handleSplitUpChange(index, 'amount', e.target.value)}
                                className="w-full pl-5 pr-2 py-1.5 text-xs font-black font-mono text-slate-900 bg-white border border-slate-200 rounded-lg outline-none text-right focus:border-blue-500"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeSplitUpRow(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addSplitUpRow('')}
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                          className="text-xs font-bold text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-50"
                        >
                          + Add Field
                        </Button>

                        <button
                          type="button"
                          onClick={handleResetCountedCash}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Reset all counted cash inputs to 0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset Counts
                        </button>
                      </div>
                    </div>

                    {/* Total Actual Counted Cash Box */}
                    <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between mt-4">
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Total Counted Cash</span>
                        <span className="text-[11px] text-slate-400">
                          {summary?.isAlreadyClosed ? 'Saved closing count' : 'Becomes tomorrow’s opening starting cash'}
                        </span>
                      </div>
                      <span className="text-xl font-black font-mono text-emerald-400">
                        ₹{actualClosingBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Reconciliation Status & Finalize Action */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-4">
                  {/* Status Banner */}
                  {isBalanced ? (
                    <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-emerald-900">Everything Matches (Zero Difference)</h4>
                          <p className="text-xs text-emerald-700">
                            Counted cash exactly equals expected closing balance (₹{actualClosingBalance.toLocaleString('en-IN')}).
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono px-3 py-1 bg-emerald-200 text-emerald-900 rounded-lg self-start sm:self-auto">
                        MATCHED
                      </span>
                    </div>
                  ) : (
                    <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-rose-900">
                            Discrepancy of {variance > 0 ? '+' : ''}₹{variance.toLocaleString('en-IN')}
                          </h4>
                          <p className="text-xs text-rose-700">
                            {variance < 0 ? (
                              <span>Shortage: Counted ₹{actualClosingBalance.toLocaleString('en-IN')} vs Expected ₹{expectedClosingBalance.toLocaleString('en-IN')}</span>
                            ) : (
                              <span>Surplus: Counted ₹{actualClosingBalance.toLocaleString('en-IN')} vs Expected ₹{expectedClosingBalance.toLocaleString('en-IN')}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono px-3 py-1 bg-rose-200 text-rose-900 rounded-lg self-start sm:self-auto">
                        UNBALANCED
                      </span>
                    </div>
                  )}

                  {/* Notes & Save Button */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <input
                      type="text"
                      placeholder="Add closing note / remark (optional)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="flex-1 w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                    />

                    <Button
                      size="md"
                      variant={isBalanced ? 'success' : 'primary'}
                      onClick={handleSaveClosing}
                      isLoading={saving}
                      leftIcon={<Save className="w-4 h-4" />}
                      className="w-full sm:w-auto px-6 font-bold shadow-sm"
                    >
                      {isBalanced ? 'Save & Close Day' : 'Save Day with Discrepancy'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Modal: Mark After-Closing Night Activity for Opening Reconciliation */}
        {isMarkingAfterClosing && (
          <Modal
            isOpen={isMarkingAfterClosing}
            onClose={() => setIsMarkingAfterClosing(false)}
            title="Mark Night Expense / Collection"
            maxWidth="md"
          >
            <form onSubmit={handleSaveAfterClosingAdjustment} className="space-y-4">
              <p className="text-xs text-slate-500">
                Record an expense or collection that occurred after closing yesterday's book. This automatically reconciles this morning's starting liquid cash without altering yesterday's historical closing balance.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType('EXPENSE')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      adjType === 'EXPENSE'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" /> Expense (-) Outflow
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('COLLECTION')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      adjType === 'COLLECTION'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" /> Collection (+) Inflow
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Night dinner, milk delivery, emergency shop supplies..."
                  value={adjTitle}
                  onChange={(e) => setAdjTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      placeholder="0.00"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={adjCategory}
                    onChange={(e) => setAdjCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-700"
                  >
                    <option value="General">General</option>
                    <option value="Food & Refreshments">Food & Refreshments</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Shop Supplies">Shop Supplies</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMarkingAfterClosing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant={adjType === 'EXPENSE' ? 'danger' : 'success'}
                  isLoading={savingAdj}
                >
                  Save & Reconcile
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};
