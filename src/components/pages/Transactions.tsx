import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'

import { useAccounts } from '@/components/hooks/useAccounts'
import { useBudgets } from '@/components/hooks/useBudgets'
import {
  OTHER_CATEGORY_NAME,
  ensureOtherBudgetCategory,
  getTransactionCategoryOptions,
} from '@/api/budgets'
import { useTransactions } from '@/components/hooks/useTransactions'
import { deleteTransaction, resetTransactions, updateTransaction } from '@/api/transactions'
import { Card, EmptyState, Spinner } from '@/components/ui'
import { AddTransactionModal } from '@/components/features/AddTransactionModal'
import type { Transaction } from '@/components/index'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

type EditableTransaction = {
  txType: 'income' | 'expense'
  amount: string
  description: string
  category: string
  date: string
}

function TransactionRow({
  tx,
  showPaidOffToggle,
  isEditing,
  editable,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
  onDelete,
  onTogglePaidOff,
  isSaving,
  isDeleting,
  editValidationError,
  categoryOptions,
}: {
  tx: Transaction
  showPaidOffToggle: boolean
  isEditing: boolean
  editable: EditableTransaction | null
  onStartEdit: (tx: Transaction) => void
  onCancelEdit: () => void
  onChangeEdit: (next: EditableTransaction) => void
  onSaveEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
  onTogglePaidOff: (tx: Transaction) => void
  isSaving: boolean
  isDeleting: boolean
  editValidationError: string | null
  categoryOptions: string[]
}) {
  const amount = tx.amount ?? 0
  const isExpense = amount < 0

  if (isEditing && editable) {
    return (
      <div className="py-3.5 md:py-4 border-b border-ink-border/60">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            value={editable.description}
            onChange={(e) => onChangeEdit({ ...editable, description: e.target.value })}
            placeholder="Description"
          />
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={editable.amount}
            onChange={(e) => onChangeEdit({ ...editable, amount: e.target.value })}
            placeholder="Amount"
          />
          <select
            value={editable.txType}
            onChange={(e) => onChangeEdit({ ...editable, txType: e.target.value as 'income' | 'expense' })}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <select
            value={editable.category}
            onChange={(e) => onChangeEdit({ ...editable, category: e.target.value })}
          >
            <option value="">Select category</option>
            {categoryOptions.includes(editable.category) ? null : (
              <option value={editable.category}>{editable.category || 'Uncategorized'}</option>
            )}
            {categoryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <input
            type="date"
            value={editable.date}
            onChange={(e) => onChangeEdit({ ...editable, date: e.target.value })}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelEdit}
            className="font-mono text-xs px-3 py-1.5 rounded border border-ink-border text-parchment-dim"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSaveEdit(tx)}
            disabled={isSaving}
            className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {editValidationError ? (
          <p className="mt-2 font-mono text-xs text-coral">{editValidationError}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-3.5 md:py-4 border-b border-ink-border/60 last:border-0 gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`font-mono text-sm text-parchment truncate ${showPaidOffToggle && tx.is_paid_off ? 'line-through opacity-60' : ''}`}>
          {tx.merchant_name ?? tx.description ?? 'Transaction'}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {tx.category ? <span className="font-mono text-xs text-gold">{tx.category}</span> : null}
          <span className="font-mono text-xs text-parchment-dim">{tx.transaction_date}</span>
          {tx.is_manual ? <span className="font-mono text-xs text-parchment-dim border border-ink-border px-1 rounded">manual</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`font-mono text-sm font-medium ${isExpense ? 'text-coral' : 'text-jade'}`}>
          {isExpense ? '−' : '+'}{fmt(Math.abs(amount))}
        </span>
        {showPaidOffToggle ? (
          <button
            type="button"
            onClick={() => onTogglePaidOff(tx)}
            className={`font-mono text-xs px-2 py-1 rounded border transition-colors ${tx.is_paid_off ? 'border-jade/40 text-jade bg-jade/10' : 'border-ink-border text-parchment-dim hover:text-parchment hover:bg-ink-raised'}`}
            title={tx.is_paid_off ? 'Mark as unpaid' : 'Mark as paid off'}
          >
            {tx.is_paid_off ? (
              <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Paid</span>
            ) : 'Unpaid'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onStartEdit(tx)}
          className="font-mono text-xs px-2 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(tx)}
          disabled={isDeleting}
          className="font-mono text-xs px-2 py-1 rounded border border-coral/40 text-coral hover:bg-coral/10 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

export default function Transactions() {
  const month = new Date().toISOString().slice(0, 7)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'date' | 'amount' | 'category'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [txType, setTxType] = useState<'' | 'income' | 'expense'>('')
  const [accountId, setAccountId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editModel, setEditModel] = useState<EditableTransaction | null>(null)
  const [editValidationError, setEditValidationError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const accounts = useAccounts()
  const budget = useBudgets()
  const { data, isLoading, isError } = useTransactions({
    limit: 200,
    page: 1,
    month: !startDate && !endDate ? month : undefined,
    search: search || undefined,
    category: category || undefined,
    account_id: accountId || undefined,
    type: txType || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    sort,
    sort_dir: sortDir,
  })

  const rows = data?.transactions ?? []
  const transactionCategoryOptions = useMemo(
    () => getTransactionCategoryOptions(budget.data),
    [budget.data],
  )
  const canLogTransactions = Boolean(budget.data)
  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((account) => [account.id, account])),
    [accounts.data],
  )

  const resetMutation = useMutation({
    mutationFn: () =>
      resetTransactions({
        category: category || undefined,
        account_id: accountId || undefined,
        type: txType || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['active-budget'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (params: { transactionId: string; payload: { amount?: number; description?: string; category?: string; date?: string; is_paid_off?: boolean } }) => {
      if (params.payload.category === OTHER_CATEGORY_NAME) {
        await ensureOtherBudgetCategory()
      }
      return updateTransaction(params.transactionId, params.payload)
    },
    onSuccess: () => {
      setEditingId(null)
      setEditModel(null)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['active-budget'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['active-budget'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] })
    },
  })

  const totalIn = rows.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalOut = rows.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)

  return (
    <div className="app-page">
      <div className="flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <h1
            className="font-display text-4xl md:text-5xl text-parchment leading-none"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
          >
            Income and Expenses
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const confirmed = window.confirm('Are you sure you want to reset the transactions in the current view?')
              if (!confirmed) {
                return
              }
              resetMutation.mutate()
            }}
            disabled={resetMutation.isPending}
            className="font-mono text-xs px-3 py-1.5 rounded border border-coral/40 text-coral hover:bg-coral/10 transition-colors disabled:opacity-50"
          >
            {resetMutation.isPending ? 'Resetting...' : 'Reset'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            disabled={!canLogTransactions}
            className="font-mono text-xs px-4 py-2.5 rounded-lg bg-gold text-white hover:bg-gold-dim transition-colors whitespace-nowrap"
            title={!canLogTransactions ? 'Set up a budget with subcategories first' : undefined}
          >
            + add income or expense
          </button>
        </div>
      </div>

      {!canLogTransactions ? (
        <Card className="animate-fade-up delay-1 border-coral/30 bg-coral/5">
          <p className="font-mono text-xs text-coral">
            Set up an active budget with subcategories before logging or importing transactions.
          </p>
        </Card>
      ) : null}

      {showAdd && canLogTransactions ? (
        <AddTransactionModal onClose={() => setShowAdd(false)} budgetCategories={transactionCategoryOptions} />
      ) : null}

      <Card className="animate-fade-up delay-1">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchant or description"
            className="xl:col-span-2"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
          />
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All accounts</option>
            {(accounts.data ?? []).map((account) => (
              <option value={account.id} key={account.id}>{account.account_name}</option>
            ))}
          </select>
          <select value={txType} onChange={(e) => setTxType(e.target.value as '' | 'income' | 'expense')}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <div className="xl:col-span-2 grid grid-cols-2 gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} title="From date" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} title="To date" />
          </div>
          <div className="flex gap-2">
            <select value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'amount' | 'category')}>
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
              <option value="category">Sort: Category</option>
            </select>
            <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <p className="text-sm font-mono text-coral">Failed to load income and expenses.</p>
      ) : rows.length === 0 ? (
        <EmptyState message="No income or expenses yet." />
      ) : (
        <>
          <div className="animate-fade-up delay-3 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="font-mono rounded-lg border border-ink-border bg-ink-card/50 px-4 py-3.5 text-center">
              <p className="text-xs text-parchment-dim mb-1">Entries</p>
              <p className="text-parchment text-lg">{data?.totalCount ?? rows.length}</p>
            </div>
            <div className="font-mono rounded-lg border border-jade/20 bg-jade/5 px-4 py-3.5 text-center">
              <p className="text-xs text-parchment-dim mb-1">In</p>
              <p className="text-jade text-lg">{fmt(totalIn)}</p>
            </div>
            <div className="font-mono rounded-lg border border-coral/20 bg-coral/5 px-4 py-3.5 text-center">
              <p className="text-xs text-parchment-dim mb-1">Out</p>
              <p className="text-coral text-lg">{fmt(totalOut)}</p>
            </div>
          </div>

          <Card className="animate-fade-up delay-4 p-0 overflow-hidden">
            <div className="px-5 md:px-6">
              {rows.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  showPaidOffToggle={
                    (accountsById.get(tx.account_id)?.account_class === 'liability') && (tx.amount ?? 0) < 0
                  }
                  isEditing={editingId === tx.id}
                  editable={editModel}
                  isSaving={updateMutation.isPending && editingId === tx.id}
                  isDeleting={deleteMutation.isPending}
                  onStartEdit={(row) => {
                    setEditingId(row.id)
                    setEditValidationError(null)
                    setEditModel({
                      txType: (row.amount ?? 0) < 0 ? 'expense' : 'income',
                      amount: String(Math.abs(row.amount ?? 0)),
                      description: row.description ?? row.merchant_name ?? '',
                      category: row.category ?? '',
                      date: row.transaction_date,
                    })
                  }}
                  onCancelEdit={() => {
                    setEditingId(null)
                    setEditModel(null)
                    setEditValidationError(null)
                  }}
                  onChangeEdit={setEditModel}
                  onTogglePaidOff={(row) => {
                    updateMutation.mutate({
                      transactionId: row.id,
                      payload: { is_paid_off: !row.is_paid_off },
                    })
                  }}
                  onSaveEdit={(row) => {
                    if (!editModel) return
                    const parsedAmount = Number(editModel.amount)
                    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                      setEditValidationError('Amount must be a number greater than 0.')
                      return
                    }
                    if (!editModel.date || !/^\d{4}-\d{2}-\d{2}$/.test(editModel.date)) {
                      setEditValidationError('Date must be in YYYY-MM-DD format.')
                      return
                    }
                    if (!editModel.category || !transactionCategoryOptions.includes(editModel.category)) {
                      setEditValidationError('Category must match a budget subcategory.')
                      return
                    }

                    setEditValidationError(null)

                    updateMutation.mutate({
                      transactionId: row.id,
                      payload: {
                        amount: editModel.txType === 'expense' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
                        description: editModel.description || undefined,
                        category: editModel.category || undefined,
                        date: editModel.date,
                      },
                    })
                  }}
                  categoryOptions={transactionCategoryOptions}
                  onDelete={(row) => {
                    const confirmed = window.confirm('Delete this income/expense entry?')
                    if (!confirmed) {
                      return
                    }
                    deleteMutation.mutate(row.id)
                  }}
                  editValidationError={editingId === tx.id ? editValidationError : null}
                />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
