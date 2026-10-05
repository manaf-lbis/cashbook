import React from 'react';

interface StatCardProps {
  title: string;
  amount: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconTextColor?: string;
  trendText?: string;
  trendPositive?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  amount,
  subtitle,
  icon,
  iconBgColor = 'bg-brand-50',
  iconTextColor = 'text-brand-600',
  trendText,
  trendPositive,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl ${iconBgColor} ${iconTextColor}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <h4 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">{amount}</h4>
        {(subtitle || trendText) && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
            {trendText && (
              <span
                className={`font-semibold ${
                  trendPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {trendText}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
