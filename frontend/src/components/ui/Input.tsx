import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, prefixText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            {label}
          </label>
        )}
        <div className="relative rounded-xl shadow-sm">
          {prefixText && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-slate-500 font-medium sm:text-sm">{prefixText}</span>
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
              prefixText ? 'pl-8' : ''
            } ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500 text-rose-900 placeholder-rose-300'
                : 'border-slate-300 hover:border-slate-400'
            } ${className}`}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
