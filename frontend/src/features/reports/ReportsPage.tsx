import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart3,
  Calendar,
  Filter,
  Download,
  Printer,
  TrendingUp,
  Receipt,
  Users,
  Award,
  Wallet,
  Building2,
  Smartphone,
  ChevronDown,
  RefreshCw,
  Search,
  ExternalLink,
  Info,
} from 'lucide-react';
import { apiClient, formatINR, formatDate, getLocalDateString } from '../../api/client';
import { ISalesReportData, IDayWiseSalesPoint, ISalespersonRanking } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

type PresetRange = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'CUSTOM';

export const ReportsPage: React.FC = () => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reportData, setReportData] = useState<ISalesReportData | null>(null);

  // Filters State
  const [preset, setPreset] = useState<PresetRange>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => getLocalDateString());
  const [selectedBillerId, setSelectedBillerId] = useState<string>('ALL');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('ALL');

  // Chart View Options
  const [chartMetric, setChartMetric] = useState<'sales' | 'bills'>('sales');
  const [hoveredPoint, setHoveredPoint] = useState<IDayWiseSalesPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Drilldown Modal / State for day entries
  const [selectedDayEntries, setSelectedDayEntries] = useState<{
    dateStr: string;
    entries: any[];
  } | null>(null);

  // Search filter for the day-wise table
  const [tableSearch, setTableSearch] = useState('');

  // Handle Preset Changes
  const applyPreset = (presetType: PresetRange) => {
    setPreset(presetType);
    const today = new Date();
    const todayStr = getLocalDateString(today);

    if (presetType === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (presetType === 'YESTERDAY') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = getLocalDateString(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (presetType === 'LAST_7_DAYS') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 6);
      setStartDate(getLocalDateString(past7));
      setEndDate(todayStr);
    } else if (presetType === 'THIS_MONTH') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      setStartDate(`${y}-${m}-01`);
      setEndDate(todayStr);
    } else if (presetType === 'LAST_30_DAYS') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 29);
      setStartDate(getLocalDateString(past30));
      setEndDate(todayStr);
    }
  };

  const fetchReport = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await apiClient.get<{ success: boolean; data: ISalesReportData }>('/reports/sales', {
        params: {
          startDate,
          endDate,
          billerId: selectedBillerId,
          paymentMode: selectedPaymentMode,
        },
      });

      if (res.data.success && res.data.data) {
        setReportData(res.data.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load sales report', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, selectedBillerId, selectedPaymentMode]);

  const handleDownloadCSV = () => {
    try {
      const token = localStorage.getItem('cashbook_auth_token');
      const url = `${apiClient.defaults.baseURL}/reports/sales/export?startDate=${startDate}&endDate=${endDate}&billerId=${selectedBillerId}&paymentMode=${selectedPaymentMode}`;
      
      // Trigger download via anchor
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      // In case Authorization token header is required via blob:
      apiClient
        .get(url, { responseType: 'blob' })
        .then((response) => {
          const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = blobUrl;
          link.setAttribute('download', `sales-report-${startDate}-to-${endDate}.csv`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          showToast('Sales report downloaded as CSV', 'success');
        })
        .catch(() => {
          showToast('Failed to download CSV export', 'error');
        });
    } catch {
      showToast('Error exporting report', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter day-wise series for table search
  const filteredDayWise = useMemo(() => {
    if (!reportData?.dayWiseSeries) return [];
    if (!tableSearch.trim()) return reportData.dayWiseSeries;
    const q = tableSearch.toLowerCase().trim();
    return reportData.dayWiseSeries.filter(
      (d) =>
        d.date.includes(q) ||
        d.formattedDate.toLowerCase().includes(q) ||
        d.weekday.toLowerCase().includes(q)
    );
  }, [reportData?.dayWiseSeries, tableSearch]);

  // Graph Calculations for Interactive SVG
  const graphPoints = useMemo(() => {
    // Viewbox width and height
    const width = 1000;
    const height = 300;
    const paddingLeft = 60;
    const paddingRight = 30;
    const paddingTop = 20;
    const paddingBottom = 40;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    if (!reportData || !reportData.dayWiseSeries || reportData.dayWiseSeries.length === 0) {
      return {
        coords: [] as Array<{ x: number; y: number; data: IDayWiseSalesPoint; value: number }>,
        maxVal: 100,
        minVal: 0,
        avgY: paddingTop + chartH,
        chartW,
        chartH,
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
        width,
        height,
      };
    }

    const series = reportData.dayWiseSeries;
    const values = series.map((s) => (chartMetric === 'sales' ? s.totalSales : s.totalBills));
    const rawMax = Math.max(...values, 0);
    // Nice rounded ceiling
    const maxVal = rawMax === 0 ? 100 : Math.ceil(rawMax * 1.15);
    const minVal = 0;

    const coords = series.map((s, idx) => {
      const val = chartMetric === 'sales' ? s.totalSales : s.totalBills;
      const x = paddingLeft + (idx / Math.max(series.length - 1, 1)) * chartW;
      const y = paddingTop + chartH - (val / (maxVal || 1)) * chartH;
      return { x, y, data: s, value: val };
    });

    const avgVal =
      chartMetric === 'sales'
        ? reportData.summary.dailyAverageSales
        : reportData.summary.activeSellingDays > 0
        ? Math.round(reportData.summary.totalBills / reportData.summary.activeSellingDays)
        : 0;
    const avgY = paddingTop + chartH - (avgVal / (maxVal || 1)) * chartH;

    return { coords, maxVal, minVal, avgY, chartW, chartH, paddingLeft, paddingRight, paddingTop, paddingBottom, width, height };
  }, [reportData, chartMetric]);

  // Path generator for line & gradient area
  const svgPaths = useMemo(() => {
    if (!graphPoints.coords || graphPoints.coords.length === 0) return { linePath: '', areaPath: '' };
    const { coords, height, paddingBottom } = graphPoints;
    if (coords.length === 1) {
      const pt = coords[0];
      return {
        linePath: `M ${pt.x - 20} ${pt.y} L ${pt.x + 20} ${pt.y}`,
        areaPath: `M ${pt.x - 20} ${height - paddingBottom} L ${pt.x - 20} ${pt.y} L ${pt.x + 20} ${pt.y} L ${pt.x + 20} ${height - paddingBottom} Z`,
      };
    }

    let linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      // Smooth cubic bezier
      const cx = (prev.x + curr.x) / 2;
      linePath += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const first = coords[0];
    const last = coords[coords.length - 1];
    const floorY = height - paddingBottom;
    const areaPath = `${linePath} L ${last.x} ${floorY} L ${first.x} ${floorY} Z`;

    return { linePath, areaPath };
  }, [graphPoints]);

  const viewEntriesForDay = (dateStr: string) => {
    if (!reportData?.recentEntries) return;
    const dayEntries = reportData.recentEntries.filter((e) => {
      const eDate = typeof e.date === 'string' ? e.date.substring(0, 10) : '';
      return eDate === dateStr;
    });
    setSelectedDayEntries({ dateStr, entries: dayEntries });
  };

  return (
    <div className="flex-1 min-h-0 h-full w-full overflow-y-auto bg-slate-50/70 scroll-smooth">
      <div className="max-w-7xl mx-auto px-3.5 py-4 sm:px-8 sm:py-8 space-y-6 pb-32">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Sales & Performance Reports
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Day-wise sales trends, salesperson filter, and revenue analytics
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReport(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-all"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-xs transition-all"
            title="Print Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600" />
            Report Parameters & Scope
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                ['TODAY', 'Today'],
                ['YESTERDAY', 'Yesterday'],
                ['LAST_7_DAYS', '7 Days'],
                ['THIS_MONTH', 'This Month'],
                ['LAST_30_DAYS', '30 Days'],
              ] as [PresetRange, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  preset === key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Salesperson Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Salesperson / Counter
            </label>
            <div className="relative">
              <select
                value={selectedBillerId}
                onChange={(e) => setSelectedBillerId(e.target.value)}
                className="w-full h-10 pl-3 pr-8 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="ALL">All Salespersons (Store Total)</option>
                {reportData?.availableBillers.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.role})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">From Date</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('CUSTOM');
                }}
                className="w-full h-10 px-3 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* To Date */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">To Date</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset('CUSTOM');
                }}
                className="w-full h-10 px-3 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Payment Mode Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Payment Mode</label>
            <div className="relative">
              <select
                value={selectedPaymentMode}
                onChange={(e) => setSelectedPaymentMode(e.target.value)}
                className="w-full h-10 pl-3 pr-8 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="ALL">All Modes (Cash, Bank, UPI)</option>
                <option value="CASH">Cash Drawer Only</option>
                <option value="BANK">Bank Transfer Only</option>
                <option value="UPI">UPI / QR Code Only</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <LoadingSpinner message="Crunching day-wise sales reports..." />
        </div>
      ) : reportData ? (
        <>
          {/* TOP SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Sales Revenue
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {formatINR(reportData.summary.totalSales)}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                <span className="font-semibold text-emerald-600">
                  {reportData.summary.activeSellingDays} selling days
                </span>
                <span>•</span>
                <span>Avg {formatINR(reportData.summary.dailyAverageSales)}/day</span>
              </div>
            </div>

            {/* Total Invoices */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Bills Count
                </span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Receipt className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {reportData.summary.totalBills.toLocaleString('en-IN')}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                <span>Avg Bill Size:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {formatINR(reportData.summary.averageBill)}
                </span>
              </div>
            </div>

            {/* Peak Sales Day */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Highest Sales Day
                </span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Award className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {formatINR(reportData.summary.highestDaySale)}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                <span>Date:</span>
                <span className="font-semibold text-slate-700">
                  {reportData.summary.highestDayDate ? formatDate(reportData.summary.highestDayDate) : 'N/A'}
                </span>
              </div>
            </div>

            {/* Top Salesperson */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Top Salesperson
                </span>
                <span className="p-2 rounded-xl bg-violet-50 text-violet-600">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl font-black text-slate-900 mt-2 truncate">
                {reportData.summary.topSalesperson?.billerName || 'No Data'}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                {reportData.summary.topSalesperson ? (
                  <>
                    <span className="font-bold text-violet-600 font-mono">
                      {formatINR(reportData.summary.topSalesperson.totalSales)}
                    </span>
                    <span>•</span>
                    <span className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-bold">
                      {reportData.summary.topSalesperson.salesSharePercentage}% share
                    </span>
                  </>
                ) : (
                  <span>No entries in selected range</span>
                )}
              </div>
            </div>
          </div>

          {/* MAIN GRAPH SECTION: DAY-WISE INTERACTIVE TREND */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Day-Wise Sales Revenue Trend
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filtered for <span className="font-bold text-slate-700">{reportData.filters.selectedBillerName}</span> from{' '}
                  <span className="font-semibold text-slate-700">{formatDate(reportData.filters.startDate)}</span> to{' '}
                  <span className="font-semibold text-slate-700">{formatDate(reportData.filters.endDate)}</span>
                </p>
              </div>

              {/* Metric Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                <button
                  onClick={() => setChartMetric('sales')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    chartMetric === 'sales'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Revenue (₹)
                </button>
                <button
                  onClick={() => setChartMetric('bills')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    chartMetric === 'bills'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bills Count
                </button>
              </div>
            </div>

            {/* SVG Visual Chart */}
            <div className="relative w-full overflow-x-auto select-none pt-2">
              <div className="min-w-[650px] relative">
                <svg
                  viewBox={`0 0 ${graphPoints.width} ${graphPoints.height}`}
                  className="w-full h-64 sm:h-72 overflow-visible"
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = graphPoints.paddingTop + graphPoints.chartH * (1 - pct);
                    const val = Math.round(graphPoints.maxVal * pct);
                    return (
                      <g key={i}>
                        <line
                          x1={graphPoints.paddingLeft}
                          y1={y}
                          x2={graphPoints.width - graphPoints.paddingRight}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray={pct === 0 ? '0' : '3 3'}
                          strokeWidth="1"
                        />
                        <text
                          x={graphPoints.paddingLeft - 10}
                          y={y + 4}
                          textAnchor="end"
                          className="text-[10px] fill-slate-400 font-mono font-medium"
                        >
                          {chartMetric === 'sales'
                            ? val >= 1000
                              ? `₹${Math.round(val / 1000)}k`
                              : `₹${val}`
                            : val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Period Daily Average Reference Line */}
                  {graphPoints.avgY > graphPoints.paddingTop && (
                    <g>
                      <line
                        x1={graphPoints.paddingLeft}
                        y1={graphPoints.avgY}
                        x2={graphPoints.width - graphPoints.paddingRight}
                        y2={graphPoints.avgY}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                      />
                      <text
                        x={graphPoints.width - graphPoints.paddingRight}
                        y={graphPoints.avgY - 6}
                        textAnchor="end"
                        className="text-[10px] fill-amber-600 font-bold"
                      >
                        Avg: {chartMetric === 'sales' ? formatINR(reportData.summary.dailyAverageSales) : `${Math.round(reportData.summary.totalBills / (reportData.summary.activeSellingDays || 1))} bills`}
                      </text>
                    </g>
                  )}

                  {/* Gradient Area Fill */}
                  {svgPaths.areaPath && (
                    <path d={svgPaths.areaPath} fill="url(#chartGradient)" />
                  )}

                  {/* Line Path */}
                  {svgPaths.linePath && (
                    <path
                      d={svgPaths.linePath}
                      fill="none"
                      stroke="url(#lineGradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Interactive Nodes */}
                  {graphPoints.coords.map((pt, idx) => {
                    const isHovered = hoveredPoint?.date === pt.data.date;
                    const isBestDay = pt.data.date === reportData.summary.highestDayDate && pt.data.totalSales > 0;
                    return (
                      <g
                        key={idx}
                        className="cursor-pointer transition-transform"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredPoint(pt.data);
                          setTooltipPos({ x: rect.left, y: rect.top });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onClick={() => viewEntriesForDay(pt.data.date)}
                      >
                        {/* Hover vertical guide line */}
                        {isHovered && (
                          <line
                            x1={pt.x}
                            y1={graphPoints.paddingTop}
                            x2={pt.x}
                            y2={graphPoints.height - graphPoints.paddingBottom}
                            stroke="#3b82f6"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                          />
                        )}

                        {/* Outer Glow on hover or best day */}
                        {(isHovered || isBestDay) && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 8 : 6}
                            fill={isBestDay ? '#f59e0b' : '#3b82f6'}
                            fillOpacity="0.2"
                          />
                        )}

                        {/* Core Circle Node */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 5 : isBestDay ? 4.5 : 3.5}
                          fill={isBestDay ? '#f59e0b' : isHovered ? '#2563eb' : '#ffffff'}
                          stroke={isBestDay ? '#b45309' : '#2563eb'}
                          strokeWidth="2.5"
                        />

                        {/* X-Axis Date Labels (Show nicely spaced) */}
                        {(graphPoints.coords.length <= 15 ||
                          idx % Math.ceil(graphPoints.coords.length / 10) === 0 ||
                          idx === graphPoints.coords.length - 1) && (
                          <text
                            x={pt.x}
                            y={graphPoints.height - graphPoints.paddingBottom + 18}
                            textAnchor="middle"
                            className={`text-[10px] font-medium ${
                              isHovered ? 'fill-blue-600 font-bold' : 'fill-slate-500'
                            }`}
                          >
                            {pt.data.dayLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Floating Interactive Tooltip */}
                {hoveredPoint && (
                  <div className="absolute top-2 right-4 bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs z-20 pointer-events-none min-w-[200px] backdrop-blur-xs border border-slate-700">
                    <p className="font-bold text-slate-200 border-b border-slate-700/80 pb-1 flex items-center justify-between">
                      <span>{hoveredPoint.formattedDate}</span>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                        {hoveredPoint.weekday}
                      </span>
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Total Revenue:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatINR(hoveredPoint.totalSales)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Bills Issued:</span>
                        <span className="font-mono font-bold text-white">
                          {hoveredPoint.totalBills} bills
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Average Bill:</span>
                        <span className="font-mono text-slate-200">
                          {formatINR(hoveredPoint.averageBill)}
                        </span>
                      </div>
                      {hoveredPoint.totalSales > 0 && (
                        <div className="pt-1.5 border-t border-slate-800 text-[11px] grid grid-cols-3 gap-1 text-slate-400 font-mono">
                          <div>
                            Cash: <span className="text-white">₹{hoveredPoint.cashSales}</span>
                          </div>
                          <div>
                            Bank: <span className="text-white">₹{hoveredPoint.bankSales}</span>
                          </div>
                          <div>
                            UPI: <span className="text-white">₹{hoveredPoint.upiSales}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-blue-400 mt-2 font-medium">Click point to view sales bills</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TWO-COLUMN SECTION: SALESPERSON COMPARISON & PAYMENT BREAKDOWN */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Salesperson Contribution Leaderboard */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    Salesperson Performance & Share
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Individual contributions to total store revenue during this period
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {reportData.salespersonRankings.length} Active Persons
                </span>
              </div>

              <div className="space-y-3.5 pt-1">
                {reportData.salespersonRankings.map((sp, idx) => (
                  <div
                    key={sp.billerId}
                    className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-800 font-black'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">
                            {sp.billerName}
                          </p>
                          <p className="text-xs text-slate-400">{sp.billerRole}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold font-mono text-slate-900">
                          {formatINR(sp.totalSales)}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          {sp.totalBills} bills • Avg {formatINR(sp.averageBill)}
                        </p>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden flex items-center">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? 'bg-blue-600'
                            : idx === 1
                            ? 'bg-indigo-500'
                            : idx === 2
                            ? 'bg-emerald-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${Math.max(sp.salesSharePercentage, 2)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1 text-[11px] text-slate-400">
                      <span>Contribution to period store revenue</span>
                      <span className="font-bold text-slate-700">{sp.salesSharePercentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  Payment Channels
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Split between Cash, Bank transfer, and UPI
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {/* Cash */}
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                      Physical Cash Drawer
                    </span>
                    <span className="text-xs font-black text-emerald-700">
                      {reportData.paymentModeBreakdown.CASH?.percentage || 0}%
                    </span>
                  </div>
                  <p className="text-lg font-bold font-mono text-emerald-900 mt-1">
                    {formatINR(reportData.paymentModeBreakdown.CASH?.totalAmount || 0)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {reportData.paymentModeBreakdown.CASH?.count || 0} transactions
                  </p>
                </div>

                {/* Bank */}
                <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold text-sky-900">
                      <Building2 className="w-3.5 h-3.5 text-sky-600" />
                      Bank Account Direct
                    </span>
                    <span className="text-xs font-black text-sky-700">
                      {reportData.paymentModeBreakdown.BANK?.percentage || 0}%
                    </span>
                  </div>
                  <p className="text-lg font-bold font-mono text-sky-900 mt-1">
                    {formatINR(reportData.paymentModeBreakdown.BANK?.totalAmount || 0)}
                  </p>
                  <p className="text-xs text-sky-600 mt-0.5">
                    {reportData.paymentModeBreakdown.BANK?.count || 0} transactions
                  </p>
                </div>

                {/* UPI */}
                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold text-purple-900">
                      <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                      UPI / QR Code
                    </span>
                    <span className="text-xs font-black text-purple-700">
                      {reportData.paymentModeBreakdown.UPI?.percentage || 0}%
                    </span>
                  </div>
                  <p className="text-lg font-bold font-mono text-purple-900 mt-1">
                    {formatINR(reportData.paymentModeBreakdown.UPI?.totalAmount || 0)}
                  </p>
                  <p className="text-xs text-purple-600 mt-0.5">
                    {reportData.paymentModeBreakdown.UPI?.count || 0} transactions
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* DAY-WISE DETAILED SUMMARY TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Day-Wise Audit Ledger
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete day-by-day record of sales, bills, and average bill size
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search date or day..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date & Day</th>
                    <th className="py-3 px-4 text-center">Bills Count</th>
                    <th className="py-3 px-4 text-right">Cash</th>
                    <th className="py-3 px-4 text-right">Bank</th>
                    <th className="py-3 px-4 text-right">UPI</th>
                    <th className="py-3 px-4 text-right">Day's Total Sales</th>
                    <th className="py-3 px-4 text-right">Avg Bill</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredDayWise.map((day) => {
                    const isZeroDay = day.totalSales === 0;
                    const isBestDay = day.date === reportData.summary.highestDayDate && day.totalSales > 0;
                    return (
                      <tr
                        key={day.date}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isBestDay ? 'bg-amber-50/40' : isZeroDay ? 'text-slate-400' : 'text-slate-700'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{day.formattedDate}</span>
                            {isBestDay && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Peak Day
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {day.totalBills > 0 ? (
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                              {day.totalBills}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {day.cashSales > 0 ? formatINR(day.cashSales) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {day.bankSales > 0 ? formatINR(day.bankSales) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {day.upiSales > 0 ? formatINR(day.upiSales) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                          {day.totalSales > 0 ? formatINR(day.totalSales) : '₹0'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {day.averageBill > 0 ? formatINR(day.averageBill) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {day.totalBills > 0 ? (
                            <button
                              onClick={() => viewEntriesForDay(day.date)}
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              View Bills
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500">No report data found for the selected criteria.</p>
        </div>
      )}

      {/* DRILLDOWN MODAL FOR DAY SALES BILLS */}
      {selectedDayEntries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Sales Bills on {formatDate(selectedDayEntries.dateStr)}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDayEntries.entries.length} bills recorded on this date
                </p>
              </div>
              <button
                onClick={() => setSelectedDayEntries(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Entries List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
              {selectedDayEntries.entries.length === 0 ? (
                <p className="text-center py-6 text-sm text-slate-400">
                  No individual bills found for this date.
                </p>
              ) : (
                selectedDayEntries.entries.map((entry, idx) => (
                  <div
                    key={entry._id || idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                          {entry.billerId?.name || 'Salesperson'}
                        </span>
                        {entry.billNumber && (
                          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
                            Bill #{entry.billNumber}
                          </span>
                        )}
                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {entry.paymentMode || 'CASH'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 mt-1">
                        {entry.customerName && <span>Customer: {entry.customerName}</span>}
                        {entry.remarks && <span>• {entry.remarks}</span>}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-emerald-600">
                        {formatINR(entry.amount)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setSelectedDayEntries(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
