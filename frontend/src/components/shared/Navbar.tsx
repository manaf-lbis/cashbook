import React from 'react';
import { Menu, Wallet, Building2, Calendar, RefreshCw } from 'lucide-react';
import { formatINR, formatDate } from '../../api/client';

interface NavbarProps {
  onToggleSidebar: () => void;
  cashInHand?: number;
  bankTotal?: number;
  totalLiquidity?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  cashInHand = 0,
  bankTotal = 0,
  totalLiquidity = 0,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
          <Calendar className="w-3.5 h-3.5 text-slate-600" />
          <span>{formatDate(new Date())}</span>
        </div>
      </div>

      {/* Live Liquidity Overview Chips */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Cash in Hand Chip */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs">
          <Wallet className="w-3.5 h-3.5 text-emerald-600" />
          <span>In Hand:</span>
          <span className="font-mono font-bold">{formatINR(cashInHand)}</span>
        </div>

        {/* Bank Total Chip */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200/60 text-sky-800 text-xs">
          <Building2 className="w-3.5 h-3.5 text-sky-600" />
          <span>Banks:</span>
          <span className="font-mono font-bold">{formatINR(bankTotal)}</span>
        </div>

        {/* Total Available Liquid Funds Badge */}
        <div className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs shadow-sm">
          <span className="text-slate-400 hidden sm:inline">Total Funds:</span>
          <span className="font-mono font-extrabold text-emerald-400">{formatINR(totalLiquidity)}</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh balances"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
