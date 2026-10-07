import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { IAccount, ApiResponse } from '../types';
import { useAuth } from './AuthContext';

interface LiquiditySummary {
  cashInHand: number;
  cashAccountId: string | null;
  bankBalancesTotal: number;
  totalLiquidity: number;
  banks: IAccount[];
}

interface AccountContextType {
  liquidity: LiquiditySummary;
  accounts: IAccount[];
  refreshAccounts: () => Promise<void>;
  isLoading: boolean;
}

const defaultLiquidity: LiquiditySummary = {
  cashInHand: 0,
  cashAccountId: null,
  bankBalancesTotal: 0,
  totalLiquidity: 0,
  banks: [],
};

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [liquidity, setLiquidity] = useState<LiquiditySummary>(defaultLiquidity);
  const [accounts, setAccounts] = useState<IAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchLiquidityAndAccounts = useCallback(async () => {
    if (!isAuthenticated) {
      setLiquidity(defaultLiquidity);
      setAccounts([]);
      return;
    }

    setIsLoading(true);
    try {
      const [liqRes, accRes] = await Promise.all([
        apiClient.get<ApiResponse<LiquiditySummary>>('/accounts/liquidity'),
        apiClient.get<ApiResponse<IAccount[]>>('/accounts'),
      ]);

      if (liqRes.data.success) {
        setLiquidity(liqRes.data.data);
      }
      if (accRes.data.success) {
        setAccounts(accRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load accounts and liquidity:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLiquidityAndAccounts();
    }
  }, [isAuthenticated, fetchLiquidityAndAccounts]);


  return (
    <AccountContext.Provider
      value={{
        liquidity,
        accounts,
        refreshAccounts: fetchLiquidityAndAccounts,
        isLoading,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccounts = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccounts must be used within an AccountProvider');
  }
  return context;
};
