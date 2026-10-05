import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCategoryName: string) => void;
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter an expense head / category name', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post('/expenses/categories', {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      if (res.data.success) {
        showToast(`Expense Head "${name}" added!`, 'success');
        onSuccess(name.trim());
        setName('');
        setDescription('');
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add expense head', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Expense Head"
      subtitle="Create a main expense account/head (e.g. Shop Expenses, Courier Expense)"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Expense Head / Category Name"
          placeholder="e.g. Shop Expenses, Courier Expense, Office Supplies"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Description / Purpose (Optional)"
          placeholder="e.g. Daily shop running costs and postage"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1" isLoading={loading}>
            Create Expense Head
          </Button>
        </div>
      </form>
    </Modal>
  );
};
