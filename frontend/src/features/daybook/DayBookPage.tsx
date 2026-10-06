import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { apiClient, formatINR, formatDateTime } from '../../api/client';
import {
  IDayBookMonth,
  IBiller,
  IDayBookEntry,
  IDayBookBillersResponse,
  IDayBookEntriesResponse,
  ApiResponse,
} from '../../types';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
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
  const [totalMonthSales, setTotalMonthSales] = useState<number>(0);
  const [totalMonthBills, setTotalMonthBills] = useState<number>(0);

  // UI state
  const [loadingMonths, setLoadingMonths] = useState<boolean>(true);
  const [loadingBillers, setLoadingBillers] = useState<boolean>(false);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'WITH_SALES' | 'ZERO_SALES'>('ALL');
  const [sortBy, setSortBy] = useState<'SALES_HIGH' | 'NAME' | 'BILLS_HIGH'>('SALES_HIGH');

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
      {/* 1. LEFT PANE: MONTHS RAIL (Future Locked, Current Active, Past View Only) */}
      {/* ======================================================== */}
      <div className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/80 flex flex-col h-full overflow-hidden">
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
      {/* 2. MIDDLE PANE: BILLING PERSONS LIST (Exactly like Khatabook Customers) */}
      {/* ======================================================== */}
      <div className="w-[390px] shrink-0 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden">
        {/* Month Summary Header Banner */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base">
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

          <div className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Month Sales
            </span>
            <span className="font-mono font-bold text-emerald-600 text-lg">
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
                  onClick={() => setSelectedBillerId(b._id)}
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
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#fafbfc]">
        {selectedBiller ? (
          <>
            {/* Ledger Header */}
            <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shadow-sm ${getAvatarColor(
                    selectedBiller.name
                  )}`}
                >
                  {selectedBiller.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-lg">{selectedBiller.name}</h3>
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
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedBiller.role} {selectedBiller.phone ? `• ${selectedBiller.phone}` : ''} • Period: {currentMonthObj?.label}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  Total Sales in {currentMonthObj?.shortLabel}
                </span>
                <p className="text-2xl font-bold font-mono text-emerald-600">
                  {formatINR(selectedBiller.monthSales)}
                </p>
              </div>
            </div>

            {/* Entries Table Header */}
            <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span className="w-40">DATE & TIME</span>
              <span className="w-28">BILL #</span>
              <span className="w-36">PAYMENT / A/C</span>
              <span className="flex-1">CUSTOMER / REMARKS</span>
              <span className="w-36 text-right pr-2">SALE AMOUNT</span>
            </div>

            {/* Entries Timeline / Stream */}
            <div className="flex-1 overflow-y-auto px-6 divide-y divide-slate-100">
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
                      ? 'Click "+ Add Sales Entry" below to record a sale.'
                      : 'No records exist in this view-only archived month.'}
                  </p>
                </div>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry._id}
                    className="py-3.5 flex items-center justify-between hover:bg-white/80 transition-colors rounded-lg px-2 group"
                  >
                    {/* Date */}
                    <div className="w-40 text-xs font-mono text-slate-600">
                      {formatDateTime(entry.date)}
                    </div>

                    {/* Bill # */}
                    <div className="w-28 text-xs font-mono">
                      {entry.billNumber ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200/80">
                          {entry.billNumber}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>

                    {/* Account / Mode */}
                    <div className="w-32 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cash Drawer</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        Counter Inflow
                      </p>
                    </div>

                    {/* Customer / Remarks + Edited Indicator */}
                    <div className="flex-1 text-xs text-slate-700 pr-4 flex items-center gap-2 overflow-hidden">
                      <div className="truncate flex-1">
                        {entry.customerName && (
                          <span className="font-semibold text-slate-900 mr-2">
                            {entry.customerName}
                          </span>
                        )}
                        <span className="text-slate-500">{entry.remarks || 'Daily Sale'}</span>
                      </div>
                      {entry.isEdited && (
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
                          Edited {entry.editLogs && entry.editLogs.length > 1 ? `(${entry.editLogs.length})` : ''}
                        </button>
                      )}
                    </div>

                    {/* Sale Amount & Actions */}
                    <div className="w-36 text-right flex items-center justify-end gap-2 pr-1">
                      <span className="font-mono font-bold text-base text-emerald-600">
                        +{formatINR(entry.amount)}
                      </span>
                      {currentMonthObj?.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit this sale entry"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="p-4 border-t border-slate-200 bg-white">
              {currentMonthObj?.status === 'ACTIVE' ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-500">
                    Record any sale transaction under <strong className="text-slate-800">{selectedBiller.name}</strong> or switch biller.
                  </div>
                  <Button
                    size="md"
                    variant="success"
                    className="px-6 shadow-sm font-bold"
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
