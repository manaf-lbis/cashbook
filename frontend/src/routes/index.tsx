import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Senior dev code-splitting: Lazy load each feature module
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ExpensesPage = lazy(() =>
  import('../features/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage }))
);
const CreditsPage = lazy(() =>
  import('../features/credits/CreditsPage').then((m) => ({ default: m.CreditsPage }))
);
const PayablesPage = lazy(() =>
  import('../features/payables/PayablesPage').then((m) => ({ default: m.PayablesPage }))
);
const CreditCardsPage = lazy(() =>
  import('../features/credit-cards/CreditCardsPage').then((m) => ({ default: m.CreditCardsPage }))
);
const DayBookPage = lazy(() =>
  import('../features/daybook/DayBookPage').then((m) => ({ default: m.DayBookPage }))
);
const DailyClosingPage = lazy(() =>
  import('../features/daily-closing/DailyClosingPage').then((m) => ({ default: m.DailyClosingPage }))
);

const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingSpinner message="Loading feature module..." />}>
    {children}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
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
