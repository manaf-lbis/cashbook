import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ToastProvider } from './context/ToastContext';
import { AccountProvider } from './context/AccountContext';
import { AuthProvider } from './context/AuthContext';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AccountProvider>
          <RouterProvider router={router} />
        </AccountProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;

