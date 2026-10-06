import React from 'react';
import { X, History, Clock } from 'lucide-react';
import { IDayBookEntry } from '../../../types';
import { formatDateTime } from '../../../api/client';
import { Button } from '../../../components/ui/Button';

interface ViewEditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: IDayBookEntry | null;
}

export const ViewEditLogModal: React.FC<ViewEditLogModalProps> = ({ isOpen, onClose, entry }) => {
  if (!isOpen || !entry) return null;

  const logs = entry.editLogs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Edit History Log</h3>
              <p className="text-xs text-slate-500">
                Current Sale: ₹{entry.amount.toLocaleString('en-IN')}{' '}
                {entry.billNumber ? `• Bill #${entry.billNumber}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Edit Logs */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5">
          {logs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No edit history recorded for this entry.</div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    {formatDateTime(log.editedAt)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                    Edit #{idx + 1}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-400 line-through">₹{log.previousAmount.toLocaleString('en-IN')}</span>
                  <span className="text-slate-400">➔</span>
                  <span className="font-bold text-emerald-600">₹{log.newAmount.toLocaleString('en-IN')}</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    ({log.newAmount - log.previousAmount >= 0 ? '+' : ''}
                    ₹{(log.newAmount - log.previousAmount).toLocaleString('en-IN')})
                  </span>
                </div>

                {log.previousRemarks !== log.newRemarks && (
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-500">Remarks: </span>
                    <span className="line-through text-slate-400">{log.previousRemarks || 'None'}</span> ➔{' '}
                    <span className="font-medium text-slate-800">{log.newRemarks || 'None'}</span>
                  </div>
                )}

                {log.previousCustomerName !== log.newCustomerName && (
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-500">Customer: </span>
                    <span className="line-through text-slate-400">{log.previousCustomerName || 'None'}</span> ➔{' '}
                    <span className="font-medium text-slate-800">{log.newCustomerName || 'None'}</span>
                  </div>
                )}

                {log.reason && (
                  <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-900">
                    <span className="font-bold">Reason: </span>
                    {log.reason}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
