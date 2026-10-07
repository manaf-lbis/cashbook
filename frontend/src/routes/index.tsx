import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/shared/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Direct synchronous imports to completely eliminate dynamic chunk loading failures on page navigation
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ExpensesPage } from '../features/expenses/ExpensesPage';
import { CreditsPage } from '../features/credits/CreditsPage';
import { PayablesPage } from '../features/payables/PayablesPage';
import { CreditCardsPage } from '../features/credit-cards/CreditCardsPage';
import { DayBookPage } from '../features/daybook/DayBookPage';
import { DailyClosingPage } from '../features/daily-closing/DailyClosingPage';

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <LoadingSpinner message="Checking security status..." />
      </div>
    );
  }
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'daybook',
        element: <DayBookPage />,
      },
      {
        path: 'daily-closing',
        element: <DailyClosingPage />,
      },
      {
        path: 'expenses',
        element: <ExpensesPage />,
      },
      {
        path: 'credits',
        element: <CreditsPage />,
      },
      {
        path: 'payables',
        element: <PayablesPage />,
      },
      {
        path: 'credit-cards',
        element: <CreditCardsPage />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
