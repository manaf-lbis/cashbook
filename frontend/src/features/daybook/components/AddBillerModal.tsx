import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface AddBillerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddBillerModal: React.FC<AddBillerModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Cashier');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter billing person name', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.post('/daybook/billers', {
        name: name.trim(),
        phone: phone.trim() || undefined,
        role: role.trim() || 'Billing Counter',
      });

      if (res.data.success) {
        showToast(`Billing person "${name}" added successfully!`, 'success');
        setName('');
        setPhone('');
        setRole('Cashier');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add billing person', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Add Billing Person</h3>
              <p className="text-xs text-slate-500">Register a counter cashier or salesperson</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Person / Counter Name"
            placeholder="e.g. Rahul (Counter 1), Arun, Main Register"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 tracking-wider mb-1">
              Role / Counter Designation
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Lead Cashier, Salesperson, Store Counter"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Add Billing Person'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
