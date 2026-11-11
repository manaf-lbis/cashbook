import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, getLocalDateString } from '../api/client';
import { ApiResponse, IDailyClosingSummary } from '../types';

export interface DayStatusInfo {
  isOpen: boolean;
  isOpened: boolean;
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
    isOpen: false,
    isOpened: false,
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
        const isOpened = !!d.isOpened;
        const isClosed = !!d.isAlreadyClosed;
        const currentHour = new Date().getHours();
        const isPending = isOpened && !isClosed && currentHour >= 20;

        setStatus({
          isOpen: isOpened && !isClosed,
          isOpened,
          isClosed,
          isPending,
          expectedBalance: d.expectedClosingBalance || 0,
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
