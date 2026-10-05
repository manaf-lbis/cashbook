import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading details...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      <p className="text-xs font-medium text-slate-500">{message}</p>
    </div>
  );
};
