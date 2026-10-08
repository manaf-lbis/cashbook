import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit3,
  FileText,
  ArrowLeft,
  Receipt,
  FolderPlus,
  Tag,
  Trash2,
  Lock,
} from 'lucide-react';
import { apiClient, formatINR, formatDateTime, formatDate, formatEntryDateTime } from '../../api/client';
import { IExpense, IExpenseCategory, ApiResponse } from '../../types';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAccounts } from '../../context/AccountContext';
import { AddExpenseModal } from './components/AddExpenseModal';
import { AddCategoryModal } from './components/AddCategoryModal';
import { EditExpenseModal } from './components/EditExpenseModal';

const CATEGORY_AVATARS = [
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-teal-100 text-teal-800 border-teal-200',
];

export const ExpensesPage: React.FC = () => {
  const { showToast } = useToast();
  const { refreshAccounts } = useAccounts();

  // State
  const [categories, setCategories] = useState<IExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<IExpense[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<IExpenseCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'WITH_SPENT' | 'ZERO_SPENT'>('ALL');
  const [sortBy, setSortBy] = useState<'SPENT_HIGH' | 'NAME' | 'COUNT_HIGH'>('SPENT_HIGH');

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<IExpense | null>(null);

  // 1. Fetch Categories with Stats
  const fetchCategories = useCallback(async (selectCategoryName?: string) => {
    try {
      setLoading(true);
      const res = await apiClient.get<ApiResponse<IExpenseCategory[]>>('/expenses/categories');
      if (res.data.success) {
        setCategories(res.data.data);
        if (selectCategoryName) {
          const found = res.data.data.find(
            (c) => c.name.toLowerCase() === selectCategoryName.toLowerCase()
          );
          if (found) setSelectedCategory(found);
        } else if (!selectedCategory && res.data.data.length > 0) {
          setSelectedCategory(res.data.data[0]);
        } else if (selectedCategory) {
          const updated = res.data.data.find((c) => c._id === selectedCategory._id);
          if (updated) setSelectedCategory(updated);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load expense categories', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedCategory?._id]);

  // 2. Fetch Expenses for Selected Category
  const fetchExpensesForCategory = useCallback(async (categoryName: string) => {
    if (!categoryName) {
      setExpenses([]);
      return;
    }
    try {
      setLoadingEntries(true);
      const res = await apiClient.get<ApiResponse<IExpense[]>>(
        `/expenses?category=${encodeURIComponent(categoryName)}&limit=200`
      );
      if (res.data.success) {
        setExpenses(res.data.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load expenses', 'error');
    } finally {
      setLoadingEntries(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (selectedCategory) {
      fetchExpensesForCategory(selectedCategory.name);
    }
  }, [selectedCategory?.name, fetchExpensesForCategory]);

  const handleDeleteExpense = async (exp: IExpense) => {
    if (exp.isDeleted) return;
    if (
      !window.confirm(
        `Are you sure you want to delete expense "${exp.title}" of ₹${exp.amount.toLocaleString(
          'en-IN'
        )}? It will be marked with a red strike, a DELETED badge, and excluded from expense totals.`
      )
    ) {
      return;
    }

    try {
      await apiClient.delete(`/expenses/${exp._id}`);
      showToast('Expense marked as deleted', 'success');
      if (selectedCategory) {
        fetchExpensesForCategory(selectedCategory.name);
      }
      fetchCategories();
      refreshAccounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete expense', 'error');
    }
  };

  // Cumulative Totals
  const totalExpenses = categories.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const totalCount = categories.reduce((sum, c) => sum + (c.count || 0), 0);

  // Filter & Sort Categories
  const filteredCategories = useMemo(() => {
    return categories
      .filter((c) => {
        if (filterType === 'WITH_SPENT') return c.totalSpent > 0;
        if (filterType === 'ZERO_SPENT') return c.totalSpent <= 0;
        return true;
      })
      .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'SPENT_HIGH') return b.totalSpent - a.totalSpent;
        if (sortBy === 'COUNT_HIGH') return b.count - a.count;
        if (sortBy === 'NAME') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [categories, filterType, searchQuery, sortBy]);

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CATEGORY_AVATARS[Math.abs(hash) % CATEGORY_AVATARS.length];
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white select-none">
      {/* ======================================================== */}
      {/* LEFT PANE: MAIN EXPENSE HEADS / DEBITORS                 */}
      {/* ======================================================== */}
      <div
        className={`w-full md:w-[420px] lg:w-[460px] flex-shrink-0 flex flex-col h-full border-r border-slate-200 bg-white ${
          selectedCategory ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center px-5 pt-3.5 border-b border-slate-200">
          <button className="pb-2.5 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2">
            Expense Heads / Categories{' '}
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {categories.length}
            </span>
          </button>
        </div>

        {/* Top Cumulative Summary Row */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between text-sm">
          <div>
            <span className="text-slate-500 font-medium">Total Expenses:</span>{' '}
            <span className="font-mono font-black text-rose-600 text-base">
              ₹{totalExpenses.toLocaleString('en-IN')} ↗
            </span>
          </div>

          <div>
            <span className="text-slate-500 font-medium">Entries:</span>{' '}
            <span className="font-mono font-bold text-slate-700 text-base">{totalCount}</span>
          </div>

          <button
            onClick={() => window.print()}
            className="text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50/80 hover:bg-blue-100 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" /> Report
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-3.5 border-b border-slate-200 space-y-3 bg-white">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Search expense heads
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. Shop Expenses, Courier, Office..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Filter By</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Expense Heads</option>
                <option value="WITH_SPENT">With Expenses (&gt; ₹0)</option>
                <option value="ZERO_SPENT">No Expenses (₹0)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="SPENT_HIGH">Spent: High to Low</option>
                <option value="COUNT_HIGH">Most Entries</option>
                <option value="NAME">Name: A to Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Categories Table Header */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span>EXPENSE HEAD</span>
          <span>TOTAL SPENT</span>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <LoadingSpinner message="Loading expense heads..." />
          ) : filteredCategories.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No expense heads found. Click <strong>+ Add Expense Head</strong> below.
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const isSelected = selectedCategory?._id === cat._id;
              const avatarClass = getAvatarColor(cat.name);
              const initial = cat.name.charAt(0).toUpperCase();

              return (
                <div
                  key={cat._id}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center flex-shrink-0 border ${avatarClass}`}
                    >
                      {initial}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {cat.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {cat.count} {cat.count === 1 ? 'item' : 'items'}
                        {cat.lastExpenseDate ? ` • ${formatDate(cat.lastExpenseDate)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-mono font-bold ${
                        cat.totalSpent > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    >
                      ₹{cat.totalSpent.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      TOTAL SPENT
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Button Bar: + Add Expense Head */}
        <div className="p-3.5 border-t border-slate-200 bg-white">
          <button
            onClick={() => setIsAddCategoryOpen(true)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <FolderPlus className="w-5 h-5" /> Add Expense Head
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT PANE: DETAIL STREAM OF SELECTED EXPENSE HEAD       */}
      {/* ======================================================== */}
      <div
        className={`flex-1 flex flex-col h-full bg-white overflow-hidden ${
          selectedCategory ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedCategory ? (
          <>
            {/* Top Detail Header */}
            <div className="px-3.5 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg -ml-1 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full font-bold text-sm sm:text-base flex items-center justify-center border shadow-2xs shrink-0 ${getAvatarColor(
                    selectedCategory.name
                  )}`}
                >
                  {selectedCategory.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                    {selectedCategory.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} recorded • Main Expense Head
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <button
                  onClick={() => window.print()}
                  className="text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" /> Report
                </button>

                <div className="text-right sm:border-l sm:border-slate-200 sm:pl-5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    TOTAL SPENT:
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono text-rose-600">
                    ₹{selectedCategory.totalSpent.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Table Header (Desktop Only) */}
            <div className="hidden sm:flex px-6 py-3 bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider items-center justify-between">
              <span className="w-44">DATE & TIME</span>
              <span className="flex-1">EXPENSE TITLE</span>
              <span className="w-32 text-right pr-4">AMOUNT</span>
              <span className="w-16 text-center">EDIT</span>
            </div>

            {/* Entries Stream */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-3 sm:px-6 space-y-2 sm:space-y-0">
              {loadingEntries ? (
                <div className="py-20 text-center text-xs text-slate-400">Loading expenses...</div>
              ) : expenses.length === 0 ? (
                <div className="py-24 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    No expenses recorded in {selectedCategory.name} yet
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Click <strong>+ Add Expense ₹</strong> below to add an expense with only title and amount.
                  </p>
                </div>
              ) : (
                expenses.map((exp) => {
                  const isDeleted = !!exp.isDeleted;
                  return (
                    <React.Fragment key={exp._id}>
                      {/* 1. Mobile Card (sm:hidden) */}
                      <div
                        className={`sm:hidden p-3 rounded-xl border transition-colors flex flex-col gap-2 ${
                          isDeleted ? 'bg-rose-50/40 border-rose-100' : 'bg-white border-slate-200/70 shadow-2xs'
                        }`}
                      >
                        {/* Top: Title & Amount */}
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`text-xs font-bold flex-1 ${
                              isDeleted ? 'text-slate-400 line-through decoration-rose-500' : 'text-slate-900'
                            }`}
                          >
                            {exp.title}
                          </span>
                          <span
                            className={`font-mono font-bold text-base shrink-0 ${
                              isDeleted
                                ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                : 'text-rose-600'
                            }`}
                          >
                            -₹{exp.amount.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Bottom: Date/Time, Badges & Actions */}
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 text-slate-500">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] text-slate-500">{formatEntryDateTime(exp.date, exp.createdAt, exp._id)}</span>
                            {exp.isReconciled && !isDeleted && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-300 uppercase"
                                title="Reconciled"
                              >
                                <Lock className="w-2.5 h-2.5" /> Reconciled
                              </span>
                            )}
                            {isDeleted && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-300 uppercase">
                                DELETED
                              </span>
                            )}
                          </div>

                          {!isDeleted && (
                            <div className="flex items-center gap-1 shrink-0">
                              {exp.isReconciled ? (
                                <span
                                  className="p-1 text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed inline-flex"
                                  title="Locked: Reconciled"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingExpense(exp)}
                                    className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExpense(exp)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Desktop Row (hidden sm:flex) */}
                      <div
                        className={`hidden sm:flex py-3.5 items-center justify-between transition-colors ${
                          isDeleted ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        {/* Date */}
                        <div
                          className={`w-44 text-xs font-mono ${
                            isDeleted
                              ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                              : 'text-slate-600'
                          }`}
                        >
                          {formatEntryDateTime(exp.date, exp.createdAt, exp._id)}
                        </div>

                        {/* Title */}
                        <div
                          className={`flex-1 text-sm font-bold pr-4 flex items-center gap-2 ${
                            isDeleted ? 'text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          <span className={isDeleted ? 'line-through decoration-rose-500 decoration-2' : ''}>
                            {exp.title}
                          </span>

                          {exp.isReconciled && !isDeleted && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300 uppercase tracking-wider shadow-2xs"
                              title="Reconciled in Daily Closing. Editing and deleting are locked."
                            >
                              <Lock className="w-2.5 h-2.5 text-slate-400" />
                              Reconciled
                            </span>
                          )}

                          {isDeleted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 uppercase tracking-wider shadow-2xs">
                              DELETED
                            </span>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="w-32 text-right pr-4">
                          <span
                            className={`font-mono font-bold text-base ${
                              isDeleted
                                ? 'text-slate-400 line-through decoration-rose-500 decoration-2'
                                : 'text-rose-600'
                            }`}
                          >
                            -₹{exp.amount.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="w-16 text-center flex items-center justify-center gap-1">
                          {!isDeleted ? (
                            exp.isReconciled ? (
                              <span
                                className="p-1.5 text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed inline-flex items-center"
                                title="Locked: Reconciled in Daily Closing. Cannot edit or delete."
                              >
                                <Lock className="w-4 h-4 text-slate-400" />
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingExpense(exp)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit this expense"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(exp)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete this expense"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )
                          ) : null}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            {/* Bottom Action Bar: + Add Expense */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
              <div className="max-w-md mx-auto">
                <button
                  onClick={() => setIsAddExpenseOpen(true)}
                  className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm sm:text-base transition-colors shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-5 h-5" /> Add Expense in {selectedCategory.name} ₹
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <Tag className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold">Select an expense head from the left to view entries</p>
          </div>
        )}
      </div>

      {/* Modal: Add Expense (Only Title and Amount) */}
      {selectedCategory && (
        <AddExpenseModal
          isOpen={isAddExpenseOpen}
          onClose={() => setIsAddExpenseOpen(false)}
          categoryName={selectedCategory.name}
          onSuccess={() => {
            fetchExpensesForCategory(selectedCategory.name);
            fetchCategories();
          }}
        />
      )}

      {/* Modal: Edit Expense (Only Title and Amount) */}
      <EditExpenseModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        onSuccess={() => {
          if (selectedCategory) {
            fetchExpensesForCategory(selectedCategory.name);
          }
          fetchCategories();
        }}
      />

      {/* Modal: Add New Expense Head / Category */}
      <AddCategoryModal
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        onSuccess={(newCatName) => {
          fetchCategories(newCatName);
        }}
      />
    </div>
  );
};

export default ExpensesPage;
