import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/shared/Sidebar';
import { MobileBottomNav } from '../components/shared/MobileBottomNav';
import { InstallBanner } from '../components/shared/InstallAppPrompt';
import { Menu, Scale, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useDayStatus } from '../context/DayStatusContext';

export const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { status } = useDayStatus();
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen bg-slate-50 flex overflow-hidden font-sans">
      {/* Sidebar (Desktop & Drawer) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Full-Width Content Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 h-full overflow-hidden bg-white">
        {/* PWA In-App Install Banner (Mobile & Windows) */}
        <InstallBanner />

        {/* Header Bar */}
        <div className="h-14 border-b border-slate-200/90 bg-white flex items-center justify-between px-3 sm:px-6 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-slate-800 text-sm tracking-tight lg:hidden">Cashbook PRO</span>
          </div>

          {/* Day Status Visual Indicator Pill */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/daily-closing')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
                status.isClosed
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  : status.isPending
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
              }`}
              title="Click to view daily reconciliation"
            >
              {status.isClosed ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Day Closed</span>
                </>
              ) : status.isPending ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Closing Due</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span>Register Open</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Area with bottom padding for mobile navigation */}
        <main className="flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden pb-16 lg:pb-0">
          <Outlet />
        </main>

        {/* Mobile Sticky Bottom Navigation with Speed Dial (+) */}
        <MobileBottomNav onOpenSidebar={() => setIsSidebarOpen(true)} />
      </div>
    </div>
  );
};
