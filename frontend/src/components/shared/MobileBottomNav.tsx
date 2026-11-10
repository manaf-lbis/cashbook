import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Users,
  Scale,
  Receipt,
  Plus,
  X,
  TrendingUp,
  CreditCard,
  LayoutDashboard,
  BarChart3,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AddExpenseModal } from '../../features/expenses/components/AddExpenseModal';
import { GiveCreditModal } from '../../features/credits/components/GiveCreditModal';
import { useAccounts } from '../../context/AccountContext';

interface BottomNavProps {
  onOpenSidebar: () => void;
}

export const MobileBottomNav: React.FC<BottomNavProps> = ({ onOpenSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();

  // Speed Dial Menu State
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);

  const navItems = [
    { label: 'Day Book', path: '/daybook', icon: CalendarDays },
    { label: 'Customers', path: '/credits', icon: Users },
    // Center action is Speed Dial '+'
    { label: 'Day Close', path: '/daily-closing', icon: Scale },
    { label: 'Expenses', path: '/expenses', icon: Receipt },
  ];

  return (
    <>
      {/* Speed Dial Overlay */}
      {isSpeedDialOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setIsSpeedDialOpen(false)}
        />
      )}

      {/* Speed Dial Action Sheet */}
      <div
        className={`fixed left-4 right-4 bottom-20 z-50 flex flex-col items-center gap-2.5 transition-all duration-200 lg:hidden ${
          isSpeedDialOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="w-full max-w-sm bg-white rounded-2xl p-3 shadow-xl border border-slate-200/80 space-y-1">
          <button
            onClick={() => {
              setIsSpeedDialOpen(false);
              navigate('/daybook');
            }}
            className="w-full flex items-center gap-3 p-3 text-left rounded-xl hover:bg-emerald-50 text-slate-700 transition-colors cursor-pointer"
          >
            <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-800">New Sale Entry</p>
              <p className="text-[11px] text-slate-400">Record biller sales in Day Book</p>
            </div>
          </button>

          <button
            onClick={() => {
              setIsSpeedDialOpen(false);
              setIsExpenseModalOpen(true);
            }}
            className="w-full flex items-center gap-3 p-3 text-left rounded-xl hover:bg-rose-50 text-slate-700 transition-colors cursor-pointer"
          >
            <span className="p-2 rounded-lg bg-rose-100 text-rose-700">
              <Receipt className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-800">Log Shop Expense</p>
              <p className="text-[11px] text-slate-400">Record cash / online payout</p>
            </div>
          </button>

          <button
            onClick={() => {
              setIsSpeedDialOpen(false);
              setIsCreditModalOpen(true);
            }}
            className="w-full flex items-center gap-3 p-3 text-left rounded-xl hover:bg-blue-50 text-slate-700 transition-colors cursor-pointer"
          >
            <span className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Users className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-800">Give Credit</p>
              <p className="text-[11px] text-slate-400">Record credit to customer ledger</p>
            </div>
          </button>
        </div>
      </div>

      {/* Persistent Bottom Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 flex items-center justify-around lg:hidden select-none shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        {/* Day Book */}
        <NavLink
          to="/daybook"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-14 h-full gap-1 transition-colors ${
              isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-[10px] leading-none">Day Book</span>
        </NavLink>

        {/* Customers */}
        <NavLink
          to="/credits"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-14 h-full gap-1 transition-colors ${
              isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] leading-none">Customers</span>
        </NavLink>

        {/* Center Floating Speed Dial Button (+) */}
        <div className="relative -top-3">
          <button
            onClick={() => setIsSpeedDialOpen(!isSpeedDialOpen)}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
              isSpeedDialOpen
                ? 'bg-rose-600 rotate-45 shadow-rose-600/30'
                : 'bg-blue-600 shadow-blue-600/35 hover:bg-blue-700'
            }`}
            aria-label="Quick Action"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Day Close */}
        <NavLink
          to="/daily-closing"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-14 h-full gap-1 transition-colors ${
              isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          <Scale className="w-5 h-5" />
          <span className="text-[10px] leading-none">Closing</span>
        </NavLink>

        {/* Expenses */}
        <NavLink
          to="/expenses"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-14 h-full gap-1 transition-colors ${
              isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] leading-none">Expenses</span>
        </NavLink>
      </nav>

      {/* Quick Modals from Bottom Navigation */}
      {isExpenseModalOpen && (
        <AddExpenseModal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          categoryName="General Expense"
          onSuccess={() => {
            refreshAccounts();
            showToast('Expense recorded successfully', 'success');
          }}
        />
      )}

      {isCreditModalOpen && (
        <GiveCreditModal
          isOpen={isCreditModalOpen}
          onClose={() => setIsCreditModalOpen(false)}
          onSuccess={() => {
            refreshAccounts();
            showToast('Credit entry recorded', 'success');
          }}
        />
      )}
    </>
  );
};
