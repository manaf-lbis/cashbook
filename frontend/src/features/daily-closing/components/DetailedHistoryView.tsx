import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Search,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Scale,
  Receipt,
  FileText,
} from 'lucide-react';
import { apiClient, formatDate } from '../../../api/client';
import { ITimelineResponse, ApiResponse } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

interface DetailedHistoryViewProps {
  onSelectDate: (date: string) => void;
}

export const DetailedHistoryView: React.FC<DetailedHistoryViewProps> = ({ onSelectDate }) => {
  const [data, setData] = useState<ITimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysCount, setDaysCount] = useState<number>(14);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CLOSED' | 'NOT_CLOSED' | 'OPENING'>('ALL');
  const [searchDate, setSearchDate] = useState('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const fetchTimeline = async (days = daysCount) => {
    try {
      setLoading(true);
      const res = await apiClient.get<ApiResponse<ITimelineResponse>>(
        `/daily-closing/timeline?days=${days}`
      );
      if (res.data.success && res.data.data) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load timeline history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline(daysCount);
  }, [daysCount]);

  // Filtered list
  const filteredTimeline = useMemo(() => {
    if (!data?.timeline) return [];
    return data.timeline.filter((item) => {
      if (statusFilter === 'CLOSED') {
        if (!item.status.startsWith('CLOSED')) return false;
      } else if (statusFilter === 'NOT_CLOSED') {
        if (item.status !== 'NOT_CLOSED') return false;
      } else if (statusFilter === 'OPENING') {
        if (item.status !== 'OPENING' && item.status !== 'OPENING_ONLY') return false;
      }

      if (searchDate && !item.date.includes(searchDate)) {
        return false;
      }
      return true;
    });
  }, [data?.timeline, statusFilter, searchDate]);

  if (loading) {
    return (
      <div className="py-28 flex justify-center">
        <LoadingSpinner message="Loading daily register audit history and timeline..." />
      </div>
    );
  }

  const metrics = data?.metrics;
  const netVariance = metrics?.totalNetVariance || 0;

  return (
    <div className="space-y-6">
      {/* 1. Hero Audit Summary Cards: Closings Health vs Period Sales vs Net Variance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Reconciled Days */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Register Reconciliations
              </span>
              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              {metrics?.closedCount || 0} / {metrics?.totalDays || 0} Days Closed
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              <strong>{metrics?.balancedCount || 0} Balanced</strong> exact matches,{' '}
              <strong>{metrics?.discrepancyCount || 0} with Discrepancy</strong>.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>● Audit Completion Rate</span>
            {(metrics?.notClosedCount || 0) > 0 ? (
              <span className="text-rose-600">{metrics?.notClosedCount} Missed Closings</span>
            ) : (
              <span className="text-emerald-600">No Missed Days</span>
            )}
          </div>
        </div>

        {/* Card 2: Period Total Sales & Expenses */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                2. Period Book Turnover
              </span>
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              ₹{(metrics?.totalPeriodSales || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              DayBook sales across the selected <strong>{metrics?.totalDays || 14} days</strong>.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>Total Expenses:</span>
            <span className="text-rose-600 font-mono font-bold">
              ₹{(metrics?.totalPeriodExpenses || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Card 3: Net Cash Audit Variance */}
        <div
          className={`rounded-2xl p-5 shadow-xs flex flex-col justify-between text-white ${
            netVariance === 0
              ? 'bg-gradient-to-br from-emerald-950 to-slate-900'
              : netVariance < 0
              ? 'bg-gradient-to-br from-rose-950 to-slate-900'
              : 'bg-gradient-to-br from-teal-950 to-slate-900'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  netVariance === 0
                    ? 'text-emerald-300'
                    : netVariance < 0
                    ? 'text-rose-300'
                    : 'text-teal-300'
                }`}
              >
                3. Period Cash Audit Variance
              </span>
              <span className="p-2 bg-white/10 rounded-xl">
                <Scale className="w-5 h-5" />
              </span>
            </div>
            <div
              className={`text-2xl font-black font-mono mt-1 ${
                netVariance === 0
                  ? 'text-emerald-400'
                  : netVariance < 0
                  ? 'text-rose-400'
                  : 'text-teal-400'
              }`}
            >
              {netVariance === 0
                ? '₹0.00 Exact Match'
                : netVariance < 0
                ? `-₹${Math.abs(netVariance).toLocaleString('en-IN')} Shortage`
                : `+₹${netVariance.toLocaleString('en-IN')} Surplus`}
            </div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {netVariance === 0
                ? 'All physical register counts matched book calculations perfectly with zero leakage.'
                : netVariance < 0
                ? 'Net cash deficit detected across closed registers. Cash was missing from drawer.'
                : 'Net cash surplus detected across closed registers. Extra drawer cash counted.'}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300 font-semibold">
            <span>Physical Drawer Audit</span>
            <span
              className={
                netVariance === 0
                  ? 'text-emerald-300'
                  : netVariance < 0
                  ? 'text-rose-300'
                  : 'text-teal-300'
              }
            >
              {netVariance === 0
                ? '● Perfect Match'
                : netVariance < 0
                ? '● Deficit Alert'
                : '● Cash Surplus'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Controls Bar: Filter Status, Range & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Days ({metrics?.totalDays || 0})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('CLOSED')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'CLOSED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Closed ({metrics?.closedCount || 0})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('NOT_CLOSED')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'NOT_CLOSED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-rose-700'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Not Closed ({metrics?.notClosedCount || 0})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('OPENING')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'OPENING'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-blue-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Opening / Inactive ({metrics?.openingCount || 0})
          </button>
        </div>

        {/* Range Selector & Search */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* Days Range Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDaysCount(7)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                daysCount === 7 ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setDaysCount(14)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                daysCount === 14 ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              14 Days
            </button>
            <button
              type="button"
              onClick={() => setDaysCount(30)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                daysCount === 30 ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              30 Days
            </button>
          </div>

          {/* Search Date Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search date..."
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 w-36"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTimeline(daysCount)}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* 3. The Clean Daily Audit Timeline */}
      <div className="space-y-3.5">
        {filteredTimeline.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
            <h4 className="font-bold text-slate-700 text-base">No days match your selected filter</h4>
            <p className="text-xs text-slate-400 mt-1">
              Switch filter to "All Days" to view the full timeline.
            </p>
          </div>
        ) : (
          filteredTimeline.map((item) => {
            const isToday = item.isToday;
            const isClosed = item.status.startsWith('CLOSED');
            const isBalanced = item.status === 'CLOSED_BALANCED';
            const isNotClosed = item.status === 'NOT_CLOSED';
            const isOpening = item.status === 'OPENING' || item.status === 'OPENING_ONLY';
            const isExpanded = expandedDate === item.date;

            return (
              <div
                key={item.date}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  isToday
                    ? 'border-blue-300 ring-2 ring-blue-50 shadow-xs'
                    : isNotClosed
                    ? 'border-rose-300 shadow-xs'
                    : 'border-slate-200/80 shadow-xs hover:border-slate-300'
                }`}
              >
                {/* Main Card Header / Summary Row */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Date & Status Badge */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Status Icon */}
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        isBalanced
                          ? 'bg-emerald-50 text-emerald-600'
                          : isNotClosed
                          ? 'bg-rose-50 text-rose-600 animate-pulse'
                          : isOpening
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {isBalanced ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : isNotClosed ? (
                        <AlertCircle className="w-6 h-6" />
                      ) : isOpening ? (
                        <Sparkles className="w-6 h-6" />
                      ) : (
                        <AlertTriangle className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-black text-slate-900 font-mono">
                          {formatDate(item.date)}
                        </span>

                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white">
                            TODAY
                          </span>
                        )}

                        {/* Status Tag */}
                        {isBalanced && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                            CLOSED (BALANCED)
                          </span>
                        )}
                        {item.status === 'CLOSED_DISCREPANCY' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                            CLOSED (DISCREPANCY)
                          </span>
                        )}
                        {isNotClosed && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                            NOT CLOSED (MISSED)
                          </span>
                        )}
                        {item.status === 'OPENING' && !isClosed && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                            REGISTER OPEN
                          </span>
                        )}
                        {item.status === 'OPENING_ONLY' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                            NO ACTIVITY (UNCLOSED)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        Opening Cash: <strong className="text-slate-800 font-mono">₹{item.openingBalance.toLocaleString('en-IN')}</strong>
                        {item.dayBookSales > 0 && ` • Sales: +₹${item.dayBookSales.toLocaleString('en-IN')}`}
                        {item.customerNet !== 0 && (
                          ` • Credit Net: ${item.customerNet > 0 ? '+' : ''}₹${item.customerNet.toLocaleString('en-IN')}`
                        )}
                        {item.expenseTotal > 0 && ` • Expenses: -₹${item.expenseTotal.toLocaleString('en-IN')}`}
                        {item.creditCardNet !== 0 && (
                          ` • Cards Net: ${item.creditCardNet > 0 ? '+' : ''}₹${item.creditCardNet.toLocaleString('en-IN')}`
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Middle: Financial Pillars (Expected vs Actual Counted vs Variance) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2 lg:py-0 border-y lg:border-y-0 border-slate-100">
                    {/* Pillar 1: Expected Closing Cash */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 min-w-[130px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Expected Closing
                      </span>
                      <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                        ₹{item.expectedClosingBalance.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">Book calculation</span>
                    </div>

                    {/* Pillar 2: Actual Counted Cash */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 min-w-[130px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Actual Counted
                      </span>
                      {item.isSaved && item.actualClosingBalance !== null ? (
                        <>
                          <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                            ₹{item.actualClosingBalance.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">Drawer & bank split-up</span>
                        </>
                      ) : isToday ? (
                        <>
                          <span className="text-xs font-bold font-mono text-blue-600 mt-1 block">
                            Register Open
                          </span>
                          <span className="text-[10px] text-blue-400 block truncate">Awaiting EOD count</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-bold font-mono text-rose-500 mt-1 block">
                            Not Counted
                          </span>
                          <span className="text-[10px] text-rose-400 block truncate">Closing was missed</span>
                        </>
                      )}
                    </div>

                    {/* Pillar 3: Cash Variance */}
                    <div
                      className={`p-2.5 rounded-xl border min-w-[140px] col-span-2 sm:col-span-1 ${
                        item.isSaved && item.variance !== null
                          ? item.variance === 0
                            ? 'bg-emerald-50/70 border-emerald-200'
                            : item.variance < 0
                            ? 'bg-rose-50/70 border-rose-200'
                            : 'bg-emerald-50/70 border-emerald-200'
                          : isToday
                          ? 'bg-blue-50/50 border-blue-200'
                          : 'bg-slate-50 border-slate-200/70'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider block ${
                          item.isSaved && item.variance !== null
                            ? item.variance === 0
                              ? 'text-emerald-800'
                              : item.variance < 0
                              ? 'text-rose-800'
                              : 'text-emerald-800'
                            : isToday
                            ? 'text-blue-800'
                            : 'text-slate-400'
                        }`}
                      >
                        Cash Variance
                      </span>
                      {item.isSaved && item.variance !== null ? (
                        item.variance === 0 ? (
                          <>
                            <span className="text-sm font-black font-mono text-emerald-700 mt-0.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              ₹0.00
                            </span>
                            <span className="text-[10px] text-emerald-600 font-medium block truncate">Exact match (Balanced)</span>
                          </>
                        ) : item.variance < 0 ? (
                          <>
                            <span className="text-sm font-black font-mono text-rose-600 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                              -₹{Math.abs(item.variance).toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-rose-600 font-medium block truncate">Shortage (Cash Deficit)</span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-black font-mono text-emerald-700 mt-0.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              +₹{item.variance.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-medium block truncate">Surplus (Cash Excess)</span>
                          </>
                        )
                      ) : isToday ? (
                        <>
                          <span className="text-xs font-bold font-mono text-blue-600 mt-1 block">In Progress</span>
                          <span className="text-[10px] text-blue-400 block truncate">Count when closing</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-bold font-mono text-rose-500 mt-1 block">Unreconciled</span>
                          <span className="text-[10px] text-rose-400 block truncate">Audit unconfirmed</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-2.5">
                    {/* Expand Split-up toggle (if closing exists) */}
                    {isClosed && item.manualSplitUps && item.manualSplitUps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedDate(isExpanded ? null : item.date)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {isExpanded ? 'Hide Count' : 'View Count'}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Action button */}
                    <Button
                      variant={isNotClosed ? 'danger' : isToday ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => onSelectDate(item.date)}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      className="text-xs font-bold"
                    >
                      {isNotClosed ? 'Close Day Now' : isToday ? 'Open Register' : 'Review Register'}
                    </Button>
                  </div>
                </div>

                {/* Expanded Count Details Drawer */}
                {isExpanded && item.manualSplitUps && (
                  <div className="px-5 pb-5 pt-3 bg-slate-50 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Physical Cash & Bank Split-Up Counted on {formatDate(item.date)}:
                      </span>
                      {item.closedAt && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          Finalized at {new Date(item.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {item.manualSplitUps.map((split, sIdx) => (
                        <div
                          key={sIdx}
                          className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between"
                        >
                          <span className="text-xs font-bold text-slate-700 truncate block">
                            {split.sourceName}
                          </span>
                          <span className="text-sm font-black font-mono text-slate-900 mt-1 block">
                            ₹{split.amount.toLocaleString('en-IN')}
                          </span>
                          {split.notes && (
                            <span className="text-[10px] text-slate-400 mt-0.5 truncate block">
                              {split.notes}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
                        <strong>Closing Remarks:</strong> "{item.notes}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
