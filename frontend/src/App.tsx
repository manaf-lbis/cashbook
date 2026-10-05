import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ToastProvider } from './context/ToastContext';
import { AccountProvider } from './context/AccountContext';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AccountProvider>
        <RouterProvider router={router} />
      </AccountProvider>
    </ToastProvider>
  );
};

export default App;
