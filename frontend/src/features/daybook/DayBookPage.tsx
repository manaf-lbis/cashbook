import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CalendarDays,
  Lock,
  Eye,
  CheckCircle2,
  Search,
  Plus,
  ArrowUpDown,
  Filter,
  User,
  Receipt,
  Building2,
  Wallet,
  Clock,
  QrCode,
  ShieldAlert,
  Edit3,
  History,
  Trash2,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';
import { apiClient, formatINR, formatDateTime, formatEntryDateTime, getEntryDateKey } from '../../api/client';
import {
  IDayBookMonth,
  IBiller,
  IDayBookEntry,
  IDayBookBillersResponse,
  IDayBookEntriesResponse,
  ApiResponse,
} from '../../types';
import { useToast } from '../../context/ToastContext';
import { useAccounts } from '../../context/AccountContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { DaySeparator } from '../../components/ui/DaySeparator';
import { AddBillerModal } from './components/AddBillerModal';
import { AddSalesEntryModal } from './components/AddSalesEntryModal';
import { EditSalesEntryModal } from './components/EditSalesEntryModal';
import { ViewEditLogModal } from './components/ViewEditLogModal';

export const DayBookPage: React.FC = () => {
  const { showToast } = useToast();

  // State
  const [months, setMonths] = useState<IDayBookMonth[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');
  const [billers, setBillers] = useState<IBiller[]>([]);
  const [selectedBillerId, setSelectedBillerId] = useState<string>('');
  const [entries, setEntries] = useState<IDayBookEntry[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(30);
  const [totalMonthSales, setTotalMonthSales] = useState<number>(0);
  const [totalMonthBills, setTotalMonthBills] = useState<number>(0);

  // UI state
  const [loadingMonths, setLoadingMonths] = useState<boolean>(true);
  const [loadingBillers, setLoadingBillers] = useState<boolean>(false);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'WITH_SALES' | 'ZERO_SALES'>('ALL');
  const [sortBy, setSortBy] = useState<'SALES_HIGH' | 'NAME' | 'BILLS_HIGH'>('SALES_HIGH');
  const [mobilePane, setMobilePane] = useState<'billers' | 'ledger'>('billers');

  // Modals
  const [isAddBillerOpen, setIsAddBillerOpen] = useState(false);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IDayBookEntry | null>(null);
  const [viewingLogEntry, setViewingLogEntry] = useState<IDayBookEntry | null>(null);

  // 1. Fetch Months List
  const fetchMonths = useCallback(async () => {
    try {
      setLoadingMonths(true);
      const res = await apiClient.get<ApiResponse<IDayBookMonth[]>>('/daybook/months');
      if (res.data.success) {
        setMonths(res.data.data);
        // Default select current active month
        const current = res.data.data.find((m) => m.isCurrent) || res.data.data.find((m) => m.status === 'ACTIVE') || res.data.data[0];
        if (current) {
          setSelectedMonthKey(current.monthKey);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load months', 'error');
    } finally {
      setLoadingMonths(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  // Current active month object
  const currentMonthObj = useMemo(() => {
    return months.find((m) => m.monthKey === selectedMonthKey);
  }, [months, selectedMonthKey]);

  // 2. Fetch Billers for the selected month
  const fetchBillersForMonth = useCallback(async (monthKey: string) => {
    if (!monthKey) return;
    try {
      setLoadingBillers(true);
      const res = await apiClient.get<ApiResponse<IDayBookBillersResponse>>(`/daybook/billers?month=${monthKey}`);
      if (res.data.success) {
        setBillers(res.data.data.billers);
        setTotalMonthSales(res.data.data.totalMonthSales);
        setTotalMonthBills(res.data.data.totalMonthBills);

        // Keep current selected biller or pick first
        setSelectedBillerId((prev) => {
          const exists = res.data.data.billers.find((b) => b._id === prev);
          return exists ? exists._id : res.data.data.billers[0]?._id || '';
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load billers', 'error');
    } finally {
      setLoadingBillers(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedMonthKey) {
      fetchBillersForMonth(selectedMonthKey);
    }
  }, [selectedMonthKey, fetchBillersForMonth]);

  // 3. Fetch Entries for selected biller & month
  const fetchEntriesForBiller = useCallback(async (billerId: string, monthKey: string) => {
    if (!billerId || !monthKey) {
      setEntries([]);
      return;
    }
    try {
      setLoadingEntries(true);
      const res = await apiClient.get<ApiResponse<IDayBookEntriesResponse>>(
        `/daybook/billers/${billerId}/entries?month=${monthKey}`
      );
      if (res.data.success) {
        setEntries(res.data.data.entries);
        setVisibleCount(30);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load entries', 'error');
    } finally {
      setLoadingEntries(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedBillerId && selectedMonthKey) {
      fetchEntriesForBiller(selectedBillerId, selectedMonthKey);
    }
  }, [selectedBillerId, selectedMonthKey, fetchEntriesForBiller]);

  // Handle Month Click
  const handleSelectMonth = (m: IDayBookMonth) => {
    if (m.status === 'LOCKED') {
      showToast(`${m.label} is a future month and is locked for entry.`, 'info');
      return;
    }
    setSelectedMonthKey(m.monthKey);
  };

  const { refreshAccounts } = useAccounts();

  const handleDeleteEntry = async (entry: IDayBookEntry) => {
    if (entry.isDeleted) return;
    if (
      !window.confirm(
        `Are you sure you want to delete this sale entry of ₹${entry.amount.toLocaleString(
          'en-IN'
        )}? It will be struck through in red, marked with a DELETED badge, and excluded from all sales calculations.`
      )
    ) {
      return;
    }

    try {
      await apiClient.delete(`/daybook/entries/${entry._id}`);
      showToast('Sales entry marked as deleted', 'success');
      fetchBillersForMonth(selectedMonthKey);
      if (selectedBillerId) {
        fetchEntriesForBiller(selectedBillerId, selectedMonthKey);
      }
      fetchMonths();
      refreshAccounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete sales entry', 'error');
    }
  };

  // Filter & Sort Billers
  const filteredBillers = useMemo(() => {
    return billers
      .filter((b) => {
        if (filterType === 'WITH_SALES') return b.monthSales > 0;
        if (filterType === 'ZERO_SALES') return b.monthSales === 0;
        return true;
      })
      .filter(
        (b) =>
          b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (b.phone && b.phone.includes(searchQuery)) ||
          b.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'SALES_HIGH') return b.monthSales - a.monthSales;
        if (sortBy === 'BILLS_HIGH') return b.monthBills - a.monthBills;
        if (sortBy === 'NAME') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [billers, filterType, searchQuery, sortBy]);

  const selectedBiller = useMemo(() => {
    return billers.find((b) => b._id === selectedBillerId);
  }, [billers, selectedBillerId]);

  // Pastel Avatar colors
  const avatarColors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-emerald-100 text-emerald-700',
    'bg-pink-100 text-pink-700',
    'bg-cyan-100 text-cyan-700',
  ];

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  if (loadingMonths && months.length === 0) {
    return <LoadingSpinner message="Loading Day Book & sales registers..." />;
  }

  return (
    <div className="h-full w-full flex overflow-hidden bg-white select-none">
      {/* ======================================================== */}
      {/* 1. LEFT PANE: MONTHS RAIL (Desktop only, mobile uses dropdown) */}
      {/* ======================================================== */}
      <div className="hidden lg:flex w-52 xl:w-56 shrink-0 border-r border-slate-200 bg-slate-50/80 flex-col h-full overflow-hidden">
        {/* Rail Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Day Book</h2>
              <p className="text-[11px] text-slate-400">Monthly Sales Ledger</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-3 py-2 bg-slate-100/60 border-b border-slate-200/60 text-[10px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
          </span>
          <span className="flex items-center gap-1 text-slate-600 font-medium">
            <Eye className="w-2.5 h-2.5" /> View Only
          </span>
          <span className="flex items-center gap-1 text-slate-400 font-medium">
            <Lock className="w-2.5 h-2.5" /> Locked
          </span>
        </div>

        {/* Months List Stream */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {months.map((m) => {
            const isSelected = m.monthKey === selectedMonthKey;
            const isLocked = m.status === 'LOCKED';
            const isActive = m.status === 'ACTIVE';
            const isViewOnly = m.status === 'VIEW_ONLY';

            return (
              <div
                key={m.monthKey}
                onClick={() => handleSelectMonth(m)}
                className={`p-3.5 transition-all cursor-pointer ${
                  isLocked
                    ? 'opacity-40 bg-slate-100/40 cursor-not-allowed hover:bg-slate-100/60'
                    : isSelected
                    ? 'bg-white border-l-4 border-emerald-500 shadow-sm'
                    : 'hover:bg-white/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isSelected ? 'text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {m.monthName}
                  </span>
                  {isActive && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      ACTIVE
                    </span>
                  )}
                  {isViewOnly && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/80 text-slate-600 flex items-center gap-0.5">
                      <Eye className="w-2.5 h-2.5" /> VIEW
                    </span>
                  )}
                  {isLocked && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/60 text-slate-400 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> LOCKED
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{m.year}</span>
                  {!isLocked && (
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {formatINR(m.totalSales)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MIDDLE PANE: BILLING PERSONS LIST */}
      {/* ======================================================== */}
      <div
        className={`w-full md:w-[350px] lg:w-[380px] shrink-0 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden ${
          mobilePane === 'ledger' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Month Summary Header Banner */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/50">
          {/* Mobile Month Switcher for < lg */}
          <div className="lg:hidden mb-2.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Month Register
            </label>
            <div className="relative">
              <select
                value={selectedMonthKey}
                onChange={(e) => {
                  const m = months.find((item) => item.monthKey === e.target.value);
                  if (m) handleSelectMonth(m);
                }}
                className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-800 py-1.5 pl-3 pr-8 rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-brand-500 shadow-2xs"
              >
                {months.map((m) => (
                  <option key={m.monthKey} value={m.monthKey} disabled={m.status === 'LOCKED'}>
                    {m.monthName} {m.year} {m.status === 'ACTIVE' ? '● Active' : m.status === 'LOCKED' ? '🔒 Locked' : '👁 View Only'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {currentMonthObj?.label || 'Day Book'}
              </h3>
              {currentMonthObj?.status === 'ACTIVE' ? (
                <Badge variant="emerald" size="sm">
                  ACTIVE
                </Badge>
              ) : (
                <Badge variant="slate" size="sm">
                  VIEW ONLY
                </Badge>
              )}
            </div>
            <span className="text-xs font-mono text-slate-500 font-medium">
              {totalMonthBills} bills
            </span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Month Sales
            </span>
            <span className="font-mono font-bold text-emerald-600 text-base sm:text-lg">
              {formatINR(totalMonthSales)}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search billing person or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white"
            />
          </div>

          {/* Filter & Sort Bar */}
          <div className="flex items-center justify-between gap-2 mt-2 text-xs">
            <div className="flex items-center gap-1 text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Billers</option>
                <option value="WITH_SALES">With Sales</option>
                <option value="ZERO_SALES">Zero Sales</option>
              </select>
            </div>

            <div className="flex items-center gap-1 text-slate-500">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="SALES_HIGH">Sales: High to Low</option>
                <option value="BILLS_HIGH">Bills: Most</option>
                <option value="NAME">Name: A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Column Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <span>BILLING PERSON</span>
          <span>MONTH SALES</span>
        </div>

        {/* Billers Stream */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingBillers ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading billers...</div>
          ) : filteredBillers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No billing persons found. Add a cashier or salesperson below.
            </div>
          ) : (
            filteredBillers.map((b) => {
              const isSelected = b._id === selectedBillerId;
              const avatarClass = getAvatarColor(b.name);

              return (
                <div
                  key={b._id}
                  onClick={() => {
                    setSelectedBillerId(b._id);
                    setMobilePane('ledger');
                  }}
                  className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 border-l-4 border-blue-600'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${avatarClass}`}
                    >
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{b.name}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {b.role} {b.phone ? `• ${b.phone}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-sm text-emerald-600">
                      {formatINR(b.monthSales)}
                    </p>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {b.monthBills} {b.monthBills === 1 ? 'bill' : 'bills'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Bar: Quick Record Sale & Add Billing Person */}
        <div className="p-3 border-t border-slate-200 bg-white space-y-2">
          {currentMonthObj?.status === 'ACTIVE' && (
            <Button
              size="md"
              variant="success"
              className="w-full font-bold shadow-sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddEntryOpen(true)}
            >
              + Record Sale ₹
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full text-slate-700 hover:bg-slate-50 border-slate-200"
            leftIcon={<Plus className="w-3.5 h-3.5 text-brand-600" />}
            onClick={() => setIsAddBillerOpen(true)}
          >
            Add Billing Person
          </Button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. RIGHT PANE: BILLER DETAIL LEDGER STREAM (Full Remaining Width) */}
      {/* ======================================================== */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden bg-[#fafbfc] ${
          mobilePane === 'billers' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedBiller ? (
          <>
            {/* Ledger Header */}
            <div className="p-3.5 sm:p-5 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobilePane('billers')}
                  className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg -ml-1 shrink-0 cursor-pointer"
                  title="Back to Billers"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base shadow-sm shrink-0 ${getAvatarColor(
                    selectedBiller.name
                  )}`}
                >
                  {selectedBiller.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-tight truncate">
                      {selectedBiller.name}
                    </h3>
                    {currentMonthObj?.status === 'ACTIVE' ? (
                      <Badge variant="emerald" size="sm">
                        ACTIVE REGISTER
                      </Badge>
                    ) : (
                      <Badge variant="slate" size="sm">
                        🔒 VIEW ONLY
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {selectedBiller.role} {selectedBiller.phone ? `• ${selectedBiller.phone}` : ''} • Period: {currentMonthObj?.label}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] sm:text-xs uppercase font-bold text-slate-400 tracking-wider block">
                  Total Sales
                </span>
                <p className="text-lg sm:text-2xl font-bold font-mono text-emerald-600">
                  {formatINR(selectedBiller.monthSales)}
                </p>
              </div>
            </div>

            {/* Entries Table Header (Desktop Only) */}
            <div className="hidden sm:flex px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider items-center justify-between">
              <span className="w-48">DATE & TIME</span>
              <span className="flex-1">REMARKS / CUSTOMER</span>
              <span className="w-36 text-right pr-2">SALE AMOUNT</span>
            </div>

            {/* Entries Timeline / Stream */}
            <div
              className="flex-1 overflow-y-auto p-3 sm:px-6 divide-y divide-slate-100 space-y-2 sm:space-y-0"
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollHeight - target.scrollTop <= target.clientHeight + 250) {
                  if (visibleCount < entries.length) {
                    setVisibleCount((prev) => Math.min(prev + 30, entries.length));
                  }
                }
              }}
            >
              {loadingEntries ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading sales records...</div>
              ) : entries.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No sales entries recorded for {selectedBiller.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {currentMonthObj?.status === 'ACTIVE'
                      ? 'Click "+ Record Sale ₹" below to record a sale.'
                      : 'No records exist in this view-only archived month.'}
                  </p>
                </div>
              ) : (
                entries.slice(0, visibleCount).map((entry, index, currentSlice) => {
                    const isDeleted = !!entry.isDeleted;
                    const dateKey = getEntryDateKey(entry.date, entry.createdAt, entry._id);
                    const prevDateKey =
                      index > 0
                        ? getEntryDateKey(currentSlice[index - 1].date, currentSlice[index - 1].createdAt, currentSlice[index - 1]._id)
                        : null;
                    const showSeparator = index === 0 || dateKey !== prevDateKey;

                  let dayTotal: number | undefined = undefined;
                  let dayCount: number | undefined = undefined;
                  if (showSeparator) {
                    const sameDayEntries = entries.filter(
                      (e) => !e.isDeleted && getEntryDateKey(e.date, e.createdAt, e._id) === dateKey
                    );
                    dayCount = sameDayEntries.length;
                    dayTotal = sameDayEntries.reduce((sum, e) => sum + e.amount, 0);
                  }

                  return (
                    <React.Fragment key={entry._id}>
                      {showSeparator && (
                        <DaySeparator
                          date={dateKey}
                          count={dayCount}
                          totalAmount={dayTotal}
                          type="sales"
                        />
                      )}
                      {/* 1. Mobile Card Layout (sm:hidden) */}
                      <div
                        className={`sm:hidden p-3 rounded-xl border transition-colors flex flex-col gap-2 ${
                          isDeleted ? 'bg-rose-50/40 border-rose-100' : 'bg-white border-slate-200/70 shadow-2xs'
                        }`}
                      >
                        {/* Top: Customer / Remarks / Bill # and Sale Amount */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs font-bold truncate ${
                                isDeleted ? 'text-slate-400 line-through decoration-rose-500' : 'text-slate-900'
                              }`}
                            >
                              {entry.remarks || entry.customerName || 'Daily Sale'}
                            </p>
                            {entry.customerName && entry.remarks && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{entry.customerName}</p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`font-mono font-bold text-base ${
                                isDeleted
                                  ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                  : 'text-emerald-600'
                              }`}
                            >
                              +{formatINR(entry.amount)}
                            </span>
                          </div>
                        </div>

                        {/* Bottom: Date/Time, Badges & Action Buttons */}
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] text-slate-500">{formatEntryDateTime(entry.date, entry.createdAt, entry._id)}</span>

                            {entry.isReconciled && !isDeleted && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-300 uppercase"
                                title="Reconciled"
                              >
                                <Lock className="w-2.5 h-2.5" /> Reconciled
                              </span>
                            )}
                            {isDeleted && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-300 uppercase">
                                DELETED
                              </span>
                            )}
                            {!isDeleted && entry.isEdited && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingLogEntry(entry);
                                }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200 cursor-pointer"
                              >
                                <History className="w-2.5 h-2.5" /> Edited
                              </button>
                            )}
                          </div>

                          {/* Actions */}
                          {!isDeleted && currentMonthObj?.status === 'ACTIVE' && (
                            <div className="flex items-center gap-1 shrink-0">
                              {entry.isReconciled ? (
                                <span
                                  className="p-1 text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed inline-flex"
                                  title="Locked: Reconciled"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntry(entry)}
                                    className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(entry)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Desktop Row Layout (hidden sm:flex) */}
                      <div
                        className={`hidden sm:flex py-3.5 items-center justify-between transition-colors rounded-lg px-2 group ${
                          isDeleted
                            ? 'bg-rose-50/40 hover:bg-rose-50/60'
                            : 'hover:bg-white/80'
                        }`}
                      >
                        {/* Date */}
                        <div
                          className={`w-48 text-xs font-mono ${
                            isDeleted
                              ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                              : 'text-slate-600'
                          }`}
                        >
                          {formatEntryDateTime(entry.date, entry.createdAt, entry._id)}
                        </div>

                        {/* Customer / Remarks + Edited & Deleted Indicators */}
                        <div className="flex-1 text-xs pr-4 flex items-center gap-2 overflow-hidden">
                          <div
                            className={`truncate flex-1 ${
                              isDeleted
                                ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                : 'text-slate-700'
                            }`}
                          >
                            {entry.customerName && (
                              <span
                                className={`font-semibold mr-2 ${
                                  isDeleted ? 'text-slate-500' : 'text-slate-900'
                                }`}
                              >
                                {entry.customerName}
                              </span>
                            )}
                            <span className={isDeleted ? 'text-slate-400' : 'text-slate-500'}>
                              {entry.remarks || 'Daily Sale'}
                            </span>
                          </div>

                          {entry.isReconciled && !isDeleted && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300 uppercase tracking-wider shadow-2xs shrink-0"
                              title="Reconciled in Daily Closing. Editing and deleting are locked."
                            >
                              <Lock className="w-2.5 h-2.5 text-slate-400" />
                              Reconciled
                            </span>
                          )}

                          {isDeleted ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 uppercase tracking-wider shadow-2xs shrink-0">
                              DELETED
                            </span>
                          ) : (
                            entry.isEdited && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingLogEntry(entry);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold border border-amber-200 flex-shrink-0 cursor-pointer transition-colors shadow-2xs"
                                title="Click to view edit history log"
                              >
                                <History className="w-3 h-3 text-amber-700" />
                                Edited{' '}
                                {entry.editLogs && entry.editLogs.length > 1
                                  ? `(${entry.editLogs.length})`
                                  : ''}
                              </button>
                            )
                          )}
                        </div>

                        {/* Sale Amount & Actions */}
                        <div className="w-36 text-right flex items-center justify-end gap-1.5 pr-1">
                          <span
                            className={`font-mono font-bold text-base ${
                              isDeleted
                                ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                : 'text-emerald-600'
                            }`}
                          >
                            +{formatINR(entry.amount)}
                          </span>

                          {!isDeleted && currentMonthObj?.status === 'ACTIVE' && (
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
                                  className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit this sale entry"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntry(entry)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete this sale entry"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}

              {/* Infinite scroll load more / all loaded status */}
              {entries.length > 0 && (
                <div className="py-4 text-center">
                  {visibleCount < entries.length ? (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => Math.min(prev + 30, entries.length))}
                      className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors shadow-2xs"
                    >
                      Loading {visibleCount} of {entries.length} entries • Click or scroll for more
                    </button>
                  ) : entries.length > 30 ? (
                    <span className="text-[11px] text-slate-400">
                      All {entries.length} records loaded for this month
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
              {currentMonthObj?.status === 'ACTIVE' ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="text-xs text-slate-500 hidden sm:block">
                    Record any sale transaction under <strong className="text-slate-800">{selectedBiller.name}</strong> or switch biller.
                  </div>
                  <Button
                    size="md"
                    variant="success"
                    className="w-full sm:w-auto px-6 shadow-sm font-bold"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setIsAddEntryOpen(true)}
                  >
                    + Record Sale ₹
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 py-1">
                  <Lock className="w-4 h-4 text-slate-400" />
                  {currentMonthObj?.label} is a previous month and is View Only. New sales entries cannot be added.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center p-8 text-center text-slate-400">
            <div>
              <User className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">Select a billing person</p>
              <p className="text-xs mt-1 mb-4">Select from the middle list or record a sale directly.</p>
              {currentMonthObj?.status === 'ACTIVE' && (
                <Button
                  size="md"
                  variant="success"
                  className="font-bold shadow-sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsAddEntryOpen(true)}
                >
                  + Record Sale ₹
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Biller Modal */}
      <AddBillerModal
        isOpen={isAddBillerOpen}
        onClose={() => setIsAddBillerOpen(false)}
        onSuccess={() => fetchBillersForMonth(selectedMonthKey)}
      />

      {/* Add Sales Entry Modal */}
      <AddSalesEntryModal
        isOpen={isAddEntryOpen}
        onClose={() => setIsAddEntryOpen(false)}
        onSuccess={() => {
          fetchBillersForMonth(selectedMonthKey);
          if (selectedBillerId) {
            fetchEntriesForBiller(selectedBillerId, selectedMonthKey);
          }
          fetchMonths();
        }}
        billers={billers}
        defaultBillerId={selectedBillerId}
        monthKey={selectedMonthKey}
      />

      {/* Edit Sales Entry Modal */}
      <EditSalesEntryModal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        entry={editingEntry}
        onSuccess={() => {
          fetchBillersForMonth(selectedMonthKey);
          if (selectedBillerId) {
            fetchEntriesForBiller(selectedBillerId, selectedMonthKey);
          }
          fetchMonths();
        }}
      />

      {/* View Edit Log Modal */}
      <ViewEditLogModal
        isOpen={!!viewingLogEntry}
        onClose={() => setViewingLogEntry(null)}
        entry={viewingLogEntry}
      />
    </div>
  );
};
export default DayBookPage;
