import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, getLocalDateString } from '../api/client';
import { ApiResponse, IDailyClosingSummary } from '../types';

export interface DayStatusInfo {
  isOpen: boolean;
  isClosed: boolean;
  isPending: boolean;
  expectedBalance: number;
  dateStr: string;
}

interface DayStatusContextType {
  status: DayStatusInfo;
  refreshDayStatus: () => Promise<void>;
}

const DayStatusContext = createContext<DayStatusContextType | undefined>(undefined);

export const DayStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<DayStatusInfo>({
    isOpen: true,
    isClosed: false,
    isPending: false,
    expectedBalance: 0,
    dateStr: getLocalDateString(),
  });

  const refreshDayStatus = useCallback(async () => {
    try {
      const today = getLocalDateString();
      const res = await apiClient.get<ApiResponse<IDailyClosingSummary>>(`/daily-closing/summary?date=${today}`);
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        const isClosed = !!d.existingClosing;
        const currentHour = new Date().getHours();
        // Closing pending if after 8:30 PM (20:30) and not closed yet
        const isPending = !isClosed && currentHour >= 20;

        const expected =
          (d.openingBalance || 0) +
          (d.dayBook?.totalSales || 0) +
          (d.customerBook?.customerNet || 0) -
          (d.expenseBook?.totalExpenses || 0) +
          (d.creditCardBook?.creditCardNet || 0);

        setStatus({
          isOpen: !isClosed,
          isClosed,
          isPending,
          expectedBalance: expected,
          dateStr: today,
        });
      }
    } catch {
      // Fallback gracefully
    }
  }, []);

  useEffect(() => {
    refreshDayStatus();
    // Re-check periodically every 10 minutes
    const interval = setInterval(refreshDayStatus, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshDayStatus]);

  return (
    <DayStatusContext.Provider value={{ status, refreshDayStatus }}>
      {children}
    </DayStatusContext.Provider>
  );
};

export const useDayStatus = () => {
  const context = useContext(DayStatusContext);
  if (!context) {
    throw new Error('useDayStatus must be used within a DayStatusProvider');
  }
  return context;
};
