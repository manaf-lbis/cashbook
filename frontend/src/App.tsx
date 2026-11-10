import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ToastProvider } from './context/ToastContext';
import { AccountProvider } from './context/AccountContext';
import { AuthProvider } from './context/AuthContext';
import { PwaProvider } from './context/PwaContext';
import { DayStatusProvider } from './context/DayStatusContext';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <PwaProvider>
        <AuthProvider>
          <AccountProvider>
            <DayStatusProvider>
              <RouterProvider router={router} />
            </DayStatusProvider>
          </AccountProvider>
        </AuthProvider>
      </PwaProvider>
    </ToastProvider>
  );
};


export default App;

