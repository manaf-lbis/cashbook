import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { ICredit, CreditTransactionType } from '../../../types';
import { formatINR, formatDateTime, formatEntryDateTime, getEntryDateKey } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { DaySeparator } from '../../../components/ui/DaySeparator';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface CreditLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  credit: ICredit | null;
}

export const CreditLedgerModal: React.FC<CreditLedgerModalProps> = ({
  isOpen,
  onClose,
  credit,
}) => {
  if (!credit) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${credit.partyName} - Credit Ledger`}
      subtitle={`Total Given: ${formatINR(credit.totalGiven)} • Repaid: ${formatINR(credit.totalRepaid)}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Given</span>
            <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
              {formatINR(credit.totalGiven)}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase">Total Repaid</span>
            <p className="font-mono font-bold text-emerald-600 text-sm mt-0.5">
              {formatINR(credit.totalRepaid)}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-amber-600 uppercase">Balance Due</span>
            <p className="font-mono font-black text-amber-600 text-sm mt-0.5">
              {formatINR(credit.balanceDue)}
            </p>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Remarks</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {credit.entries && credit.entries.length > 0 ? (
                credit.entries.map((entry, idx) => {
                  const dateKey = getEntryDateKey(entry.date, (entry as any).createdAt, (entry as any)._id);
                  const prevDateKey =
                    idx > 0
                      ? getEntryDateKey(credit.entries[idx - 1].date, (credit.entries[idx - 1] as any).createdAt, (credit.entries[idx - 1] as any)._id)
                      : null;
                  const showSeparator = idx === 0 || dateKey !== prevDateKey;

                  return (
                    <React.Fragment key={entry._id || idx}>
                      {showSeparator && (
                        <tr>
                          <td colSpan={4} className="p-0 border-none bg-slate-50/40">
                            <DaySeparator date={dateKey} type="credit" className="py-1" />
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {formatEntryDateTime(entry.date, (entry as any).createdAt, (entry as any)._id)}
                        </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={entry.type === CreditTransactionType.GIVEN ? 'rose' : 'emerald'}
                        size="sm"
                      >
                        {entry.type === CreditTransactionType.GIVEN ? 'GIVEN' : 'REPAYMENT'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {entry.remarks || '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        entry.type === CreditTransactionType.GIVEN
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {entry.type === CreditTransactionType.GIVEN ? '-' : '+'}
                      {formatINR(entry.amount)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })
          ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No transactions recorded for this party.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
