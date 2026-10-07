import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { ICreditCard, ICreditCardTransaction, CreditCardTransactionType, ApiResponse } from '../../../types';
import { apiClient, formatINR, formatDateTime, formatEntryDateTime } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

interface CardLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: ICreditCard | null;
}

export const CardLedgerModal: React.FC<CardLedgerModalProps> = ({
  isOpen,
  onClose,
  card,
}) => {
  const [transactions, setTransactions] = useState<ICreditCardTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (card && isOpen) {
      setLoading(true);
      apiClient
        .get<ApiResponse<ICreditCardTransaction[]>>(`/credit-cards/${card._id}/transactions`)
        .then((res) => {
          if (res.data.success) {
            setTransactions(res.data.data);
          }
        })
        .catch((err) => console.error('Failed to load card txs:', err))
        .finally(() => setLoading(false));
    }
  }, [card, isOpen]);

  if (!card) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${card.cardName} (Ending ${card.last4Digits})`}
      subtitle={`Total Outstanding Debt: ${formatINR(card.totalOutstanding)} • Available Limit: ${formatINR(card.availableLimit)}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {loading ? (
          <LoadingSpinner message="Fetching card statement..." />
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Account Flow / Remarks</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Card Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No transactions recorded for this card yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {formatEntryDateTime(tx.date, (tx as any).createdAt)}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            tx.type === CreditCardTransactionType.PAYMENT
                              ? 'emerald'
                              : tx.type === CreditCardTransactionType.CASH_DRAWN
                              ? 'amber'
                              : 'indigo'
                          }
                          size="sm"
                        >
                          {tx.type === CreditCardTransactionType.CASH_DRAWN
                            ? 'CASH DRAWN'
                            : tx.type === CreditCardTransactionType.PAYMENT
                            ? 'BILL PAYMENT'
                            : 'PURCHASE'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {tx.depositToAccountId && (
                          <span className="block text-[11px] text-emerald-700 font-semibold">
                            Deposited to: {tx.depositToAccountId.name}
                          </span>
                        )}
                        {tx.paidFromAccountId && (
                          <span className="block text-[11px] text-slate-700 font-semibold">
                            Paid from: {tx.paidFromAccountId.name}
                          </span>
                        )}
                        <span>{tx.remarks || '—'}</span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold ${
                          tx.type === CreditCardTransactionType.PAYMENT
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {tx.type === CreditCardTransactionType.PAYMENT ? '-' : '+'}
                        {formatINR(tx.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                        {formatINR(tx.balanceAfter)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
