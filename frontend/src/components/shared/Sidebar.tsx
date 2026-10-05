import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  Receipt,
  CreditCard,
  ChevronDown,
  CalendarDays,
  LayoutDashboard,
  Scale,
} from 'lucide-react';
import { useAccounts } from '../../context/AccountContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { liquidity } = useAccounts();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Day Book', path: '/daybook', icon: CalendarDays },
    { label: 'Day Open & Close', path: '/daily-closing', icon: Scale },
    { label: 'Customers', path: '/credits', icon: Users },
    { label: 'Expenses', path: '/expenses', icon: Receipt },
    { label: 'Credit Cards', path: '/credit-cards', icon: CreditCard },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white text-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } border-r border-slate-200/80 select-none shadow-xs`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center px-5 gap-2 border-b border-slate-100 bg-white">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2 font-sans">
            Cashbook <span className="bg-blue-600 text-[10px] font-black uppercase px-2 py-0.5 rounded text-white tracking-wider">PRO</span>
          </h1>
        </div>

        {/* Profile Card */}
        <div className="p-3">
          <div className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                S
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 leading-tight">My Shop</p>
                <p className="text-xs text-slate-500 font-mono">9876543210</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs text-emerald-600 font-semibold">Online</span>
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* Section Heading */}
        <div className="px-5 pt-3 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          LEDGER MANAGEMENT
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-xs border-l-4 border-blue-600 pl-3 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`
                }
              >
                {({ isActive }) => (
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-5 h-5 ${
                        isActive ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Quick Info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>In Hand Cash:</span>
            <span className="font-mono font-bold text-emerald-600 text-sm">
              ₹{liquidity.cashInHand.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
            <span>Total Liquid:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              ₹{liquidity.totalLiquidity.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
