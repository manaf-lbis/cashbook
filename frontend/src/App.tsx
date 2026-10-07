import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ToastProvider } from './context/ToastContext';
import { AccountProvider } from './context/AccountContext';
import { AuthProvider } from './context/AuthContext';
import { PwaProvider } from './context/PwaContext';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <PwaProvider>
        <AuthProvider>
          <AccountProvider>
            <RouterProvider router={router} />
          </AccountProvider>
        </AuthProvider>
      </PwaProvider>
    </ToastProvider>
  );
};


export default App;

