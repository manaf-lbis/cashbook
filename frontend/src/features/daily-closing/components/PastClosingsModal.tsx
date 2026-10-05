import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { formatINR, formatDate, apiClient } from '../../../api/client';
import { IDailyClosing, ApiResponse } from '../../../types';
import { CheckCircle2, AlertTriangle, Calendar, Layers, ChevronRight } from 'lucide-react';

interface PastClosingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
}

export const PastClosingsModal: React.FC<PastClosingsModalProps> = ({
  isOpen,
  onClose,
  onSelectDate,
}) => {
  const [history, setHistory] = useState<IDailyClosing[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IDailyClosing | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<ApiResponse<IDailyClosing[]>>('/daily-closing/history?limit=30');
      if (res.data.success) {
        setHistory(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Closing History & Reconciliation Audit"
      subtitle="View past day closures, opening/closing continuity, and cash variances"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner message="Loading historical closures..." />
          </div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-slate-600">No past daily closures found</p>
            <p className="text-xs text-slate-400 mt-1">
              Finalize today's day closing to record your first audited entry.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
            {history.map((record) => {
              const isBalanced = record.status === 'BALANCED';
              const isSelected = selectedRecord?._id === record._id;

              return (
                <div
                  key={record._id || record.date}
                  className={`p-4 transition-colors ${
                    isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isBalanced
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isBalanced ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm font-mono">
                            {formatDate(record.date)}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isBalanced
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {isBalanced ? 'BALANCED' : 'DISCREPANCY'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Opening: ₹{record.openingBalance.toLocaleString('en-IN')} • Expected: ₹{record.expectedClosingBalance.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Actual Cash</span>
                        <span className="text-sm font-bold font-mono text-slate-900">
                          ₹{record.actualClosingBalance.toLocaleString('en-IN')}
                        </span>
                        {record.variance !== 0 && (
                          <span
                            className={`text-xs font-mono font-bold block ${
                              record.variance > 0 ? 'text-amber-600' : 'text-rose-600'
                            }`}
                          >
                            {record.variance > 0 ? '+' : ''}₹{record.variance.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedRecord(null);
                            } else {
                              setSelectedRecord(record);
                            }
                          }}
                        >
                          {isSelected ? 'Hide Split-up' : 'View Split-up'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onSelectDate(record.date);
                            onClose();
                          }}
                          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                        >
                          Load Date
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Split-up View */}
                  {isSelected && (
                    <div className="mt-3.5 pt-3 border-t border-slate-200/80 bg-white/80 p-3 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-slate-50 p-2 rounded">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Day Book Sales</span>
                          <span className="font-bold text-emerald-600 font-mono">
                            +₹{record.dayBookSales.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer Net</span>
                          <span className="font-bold text-blue-600 font-mono">
                            {record.customerNet >= 0 ? '+' : ''}₹{record.customerNet.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Expenses</span>
                          <span className="font-bold text-rose-600 font-mono">
                            -₹{record.expenseTotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Credit Cards</span>
                          <span className="font-bold text-purple-600 font-mono">
                            {record.creditCardNet >= 0 ? '+' : ''}₹{record.creditCardNet.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Split-up sources */}
                      <div className="pt-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Manual Cash & Bank Split-up:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {record.manualSplitUps.map((item, idx) => (
                            <div key={idx} className="bg-slate-100/80 px-2.5 py-1.5 rounded text-xs flex justify-between">
                              <span className="font-semibold text-slate-700">{item.sourceName}</span>
                              <span className="font-mono font-bold text-slate-900">
                                ₹{item.amount.toLocaleString('en-IN')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {record.notes && (
                        <p className="text-xs text-slate-500 italic mt-1 pt-1 border-t border-slate-100">
                          Note: "{record.notes}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
