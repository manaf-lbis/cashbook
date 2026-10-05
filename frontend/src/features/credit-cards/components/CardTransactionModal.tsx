import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { apiClient, formatINR } from '../../../api/client';
import { ICreditCard, IAccount, CreditCardTransactionType } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { useAccounts } from '../../../context/AccountContext';

interface CardTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: ICreditCard | null;
  accounts: IAccount[];
  defaultType?: CreditCardTransactionType;
  onSuccess: () => void;
}

export const CardTransactionModal: React.FC<CardTransactionModalProps> = ({
  isOpen,
  onClose,
  card,
  accounts,
  defaultType = CreditCardTransactionType.PURCHASE,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();
  const [type, setType] = useState<CreditCardTransactionType>(defaultType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [depositToAccountId, setDepositToAccountId] = useState('');
  const [paidFromAccountId, setPaidFromAccountId] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  if (!card) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/credit-cards/transaction', {
        cardId: card._id,
        type,
        amount: numAmount,
        depositToAccountId: type === CreditCardTransactionType.CASH_DRAWN && depositToAccountId ? depositToAccountId : undefined,
        paidFromAccountId: type === CreditCardTransactionType.PAYMENT && paidFromAccountId ? paidFromAccountId : undefined,
        description: description.trim() || undefined,
        remarks: description.trim() || undefined,
      });

      showToast(`Transaction recorded on ${card.cardName}`, 'success');
      await refreshAccounts();
      onSuccess();
      onClose();

      setAmount('');
      setDescription('');
      setShowOptions(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to record transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const accountOptions = [
    { value: '', label: 'None (Direct Card Transaction)' },
    ...accounts.map((acc) => ({
      value: acc._id,
      label: `${acc.name} (${acc.type}) - Balance: ₹${acc.balance.toLocaleString('en-IN')}`,
    })),
  ];

  const typeOptions = [
    { value: CreditCardTransactionType.PURCHASE, label: 'Card Swipe / Purchase (Increases Debt)' },
    { value: CreditCardTransactionType.CASH_DRAWN, label: 'Cash Drawn / ATM Withdrawal (Increases Debt)' },
    { value: CreditCardTransactionType.PAYMENT, label: 'Card Bill Payment (Reduces Debt)' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Card Entry - ${card.cardName}`}
      subtitle={`Ending ${card.last4Digits} • Available Limit: ${formatINR(card.availableLimit)}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount"
          type="number"
          prefixText="₹"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="1"
          step="any"
          autoFocus
        />

        <Input
          label="Description"
          placeholder="e.g. Fuel, groceries, shop purchase, bill settlement"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Collapsible More Options */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            {showOptions ? '▲ Hide Details' : '▼ More Options (Type & Account)'}
          </button>

          {showOptions && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <Select
                label="Transaction Type"
                value={type}
                onChange={(e) => setType(e.target.value as CreditCardTransactionType)}
                options={typeOptions}
              />

              {type === CreditCardTransactionType.CASH_DRAWN && (
                <Select
                  label="Deposit Drawn Cash Into (Optional)"
                  value={depositToAccountId}
                  onChange={(e) => setDepositToAccountId(e.target.value)}
                  options={accountOptions}
                  helperText="Depositing into Cash in Hand will add funds to your counter drawer."
                />
              )}

              {type === CreditCardTransactionType.PAYMENT && (
                <Select
                  label="Paid From (Account) (Optional)"
                  value={paidFromAccountId}
                  onChange={(e) => setPaidFromAccountId(e.target.value)}
                  options={accountOptions}
                  helperText="Funds will be deducted from this account and reduce card debt."
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
          >
            Record Entry
          </Button>
        </div>
      </form>
    </Modal>
  );
};
