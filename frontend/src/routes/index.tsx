import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/shared/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

function lazyRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const isRefreshed =
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem('chunk_load_failed_refreshed') === 'true';

    try {
      const component = await componentImport();
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('chunk_load_failed_refreshed', 'false');
      }
      return component;
    } catch (error) {
      if (!isRefreshed && typeof window !== 'undefined') {
        console.warn(
          '[Vite] Stale deploy chunk detected on dynamic import. Auto-refreshing to fetch latest assets...',
          error
        );
        window.sessionStorage.setItem('chunk_load_failed_refreshed', 'true');
        window.location.reload();
        return { default: (() => null) as unknown as T };
      }
      throw error;
    }
  });
}

const LoginPage = lazyRetry(() =>
  import('../features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const DashboardPage = lazyRetry(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ExpensesPage = lazyRetry(() =>
  import('../features/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage }))
);
const CreditsPage = lazyRetry(() =>
  import('../features/credits/CreditsPage').then((m) => ({ default: m.CreditsPage }))
);
const PayablesPage = lazyRetry(() =>
  import('../features/payables/PayablesPage').then((m) => ({ default: m.PayablesPage }))
);
const CreditCardsPage = lazyRetry(() =>
  import('../features/credit-cards/CreditCardsPage').then((m) => ({ default: m.CreditCardsPage }))
);
const DayBookPage = lazyRetry(() =>
  import('../features/daybook/DayBookPage').then((m) => ({ default: m.DayBookPage }))
);
const DailyClosingPage = lazyRetry(() =>
  import('../features/daily-closing/DailyClosingPage').then((m) => ({ default: m.DailyClosingPage }))
);


const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingSpinner message="Loading feature module..." />}>
    {children}
  </Suspense>
);

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
        <SuspenseWrapper>
          <LoginPage />
        </SuspenseWrapper>
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
        element: (
          <SuspenseWrapper>
            <DashboardPage />
          </SuspenseWrapper>
        ),
      },

      {
        path: 'daybook',
        element: (
          <SuspenseWrapper>
            <DayBookPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'daily-closing',
        element: (
          <SuspenseWrapper>
            <DailyClosingPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'expenses',
        element: (
          <SuspenseWrapper>
            <ExpensesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'credits',
        element: (
          <SuspenseWrapper>
            <CreditsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'payables',
        element: (
          <SuspenseWrapper>
            <PayablesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'credit-cards',
        element: (
          <SuspenseWrapper>
            <CreditCardsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
