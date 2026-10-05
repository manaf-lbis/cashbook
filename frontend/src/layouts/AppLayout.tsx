import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/shared/Sidebar';
import { Menu } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-slate-50 flex overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Full-Width Content Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 h-full overflow-hidden bg-white">
        {/* Mobile Header Bar */}
        <div className="lg:hidden h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-slate-800 text-sm">Cashbook PRO</span>
          <div className="w-5" />
        </div>

        <Outlet />
      </div>
    </div>
  );
};
