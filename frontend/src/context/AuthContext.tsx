import React, { createContext, useContext, useState, useEffect } from 'react';
import { IUser, ILoginResponse, ApiResponse } from '../types';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('cashbook_auth_token');
  });

  const [user, setUser] = useState<IUser | null>(() => {
    const saved = localStorage.getItem('cashbook_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session on app initialization
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('cashbook_auth_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiClient.get<ApiResponse<IUser>>('/auth/me');
        if (response.data && response.data.data) {
          setUser(response.data.data);
          localStorage.setItem('cashbook_user', JSON.stringify(response.data.data));
        }
      } catch (err) {
        console.warn('Session verification failed, logging out:', err);
        localStorage.removeItem('cashbook_auth_token');
        localStorage.removeItem('cashbook_user');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    const response = await apiClient.post<ApiResponse<ILoginResponse>>('/auth/login', {
      username: username.trim(),
      password,
    });

    if (response.data && response.data.data) {
      const { token: receivedToken, user: receivedUser } = response.data.data;
      localStorage.setItem('cashbook_auth_token', receivedToken);
      localStorage.setItem('cashbook_user', JSON.stringify(receivedUser));
      setToken(receivedToken);
      setUser(receivedUser);
    }
  };

  const logout = () => {
    localStorage.removeItem('cashbook_auth_token');
    localStorage.removeItem('cashbook_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
