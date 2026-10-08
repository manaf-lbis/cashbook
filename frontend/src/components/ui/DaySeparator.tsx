import React from 'react';
import { Calendar } from 'lucide-react';
import { formatDaySeparatorLabel, formatINR } from '../../api/client';

export interface DaySeparatorProps {
  date: string; // 'YYYY-MM-DD' or formatted date string
  totalAmount?: number;
  count?: number;
  type?: 'sales' | 'expense' | 'credit' | 'payable' | 'card' | 'neutral';
  className?: string;
}

export const DaySeparator: React.FC<DaySeparatorProps> = ({
  date,
  totalAmount,
  count,
  type = 'neutral',
  className = '',
}) => {
  const label = formatDaySeparatorLabel(date);
  if (!label) return null;

  return (
    <div className={`py-3 flex items-center justify-center select-none w-full ${className}`}>
      <div className="flex-1 border-t border-slate-200/80" />
      <div className="mx-2 sm:mx-3 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200/70 border border-slate-200/90 shadow-2xs flex items-center gap-2 text-xs font-semibold text-slate-700 transition-colors">
        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="tracking-tight">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-600 font-mono font-medium">
            {count} {count === 1 ? 'entry' : 'entries'}
          </span>
        )}
        {totalAmount !== undefined && totalAmount > 0 && (
          <span
            className={`font-mono font-bold text-xs ${
              type === 'sales'
                ? 'text-emerald-700'
                : type === 'expense'
                ? 'text-rose-600'
                : type === 'credit'
                ? 'text-amber-700'
                : 'text-slate-800'
            }`}
          >
            {type === 'sales' ? '+' : type === 'expense' ? '-' : ''}
            {formatINR(totalAmount)}
          </span>
        )}
      </div>
      <div className="flex-1 border-t border-slate-200/80" />
    </div>
  );
};
