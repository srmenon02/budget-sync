import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'

import { useAccounts } from '@/components/hooks/useAccounts'
import { useTransactions } from '@/components/hooks/useTransactions'
import { bulkImportTransactions, deleteTransaction, resetTransactions, updateTransaction } from '@/api/transactions'
import { Card, EmptyState, Spinner } from '@/components/ui'
import { AddTransactionModal } from '@/components/features/AddTransactionModal'
import type { Transaction } from '@/components/index'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

type BulkTxItem = {
  description?: string
  amount: number
  category?: string
  date?: string
  notes?: string
  tx_type?: 'income' | 'expense'
}

type EditableTransaction = {
  txType: 'income' | 'expense'
  amount: string
  description: string
  category: string
  date: string
}

function parseStrictTransactionRows(rows: string[][]): BulkTxItem[] {
  if (rows.length < 2) {
    throw new Error('File must include headers and at least one data row.')
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const expected = ['description', 'amount', 'category', 'date', 'type', 'notes']
  const mismatch = expected.some((value, index) => header[index] !== value)
  if (mismatch || header.length < expected.length) {
    throw new Error('Invalid header. Expected: description,amount,category,date,type,notes')
  }

  const parsed: BulkTxItem[] = []

  for (let i = 1; i < rows.length; i += 1) {
    const lineNumber = i + 1
    const row = rows[i]
    if (!row || row.every((cell) => !String(cell ?? '').trim())) {
      continue
    }

    const description = String(row[0] ?? '').trim()
    const amountRaw = String(row[1] ?? '').trim()
    const category = String(row[2] ?? '').trim()
    const dateValue = String(row[3] ?? '').trim()
    const typeRaw = String(row[4] ?? '').trim().toLowerCase()
    const notes = String(row[5] ?? '').trim()

    if (!description) {
      throw new Error(`Line ${lineNumber}: description is required.`)
    }

    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Line ${lineNumber}: amount must be a number greater than 0.`)
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      throw new Error(`Line ${lineNumber}: date must be YYYY-MM-DD.`)
    }

    if (typeRaw !== 'income' && typeRaw !== 'expense') {
      throw new Error(`Line ${lineNumber}: type must be income or expense.`)
    }

    parsed.push({
      description,
      amount,
      category: category || undefined,
      date: dateValue,
      notes: notes || undefined,
      tx_type: typeRaw,
    })
  }

  if (parsed.length === 0) {
    throw new Error('No valid rows found in import data.')
  }

  return parsed
}

function parseCsvTextRows(rawText: string): string[][] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.trim()))
}

function TransactionRow({
  tx,
  isEditing,
  editable,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
  onDelete,
  isSaving,
  isDeleting,
}: {
  tx: Transaction
  isEditing: boolean
  editable: EditableTransaction | null
  onStartEdit: (tx: Transaction) => void
  onCancelEdit: () => void
  onChangeEdit: (next: EditableTransaction) => void
  onSaveEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
  isSaving: boolean
  isDeleting: boolean
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
          <input
            value={editable.category}
            onChange={(e) => onChangeEdit({ ...editable, category: e.target.value })}
            placeholder="Category"
          />
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
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-3.5 md:py-4 border-b border-ink-border/60 last:border-0 gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-mono text-sm text-parchment truncate">
          {tx.merchant_name ?? tx.description ?? 'Transaction'}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {tx.category ? <span className="font-mono text-xs text-gold/70">{tx.category}</span> : null}
          <span className="font-mono text-xs text-parchment-dim">{tx.transaction_date}</span>
          {tx.is_manual ? <span className="font-mono text-xs text-parchment-dim/50 border border-ink-border px-1 rounded">manual</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`font-mono text-sm font-medium ${isExpense ? 'text-coral' : 'text-jade'}`}>
          {isExpense ? '−' : '+'}{fmt(Math.abs(amount))}
        </span>
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
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'date' | 'amount' | 'category'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [txType, setTxType] = useState<'' | 'income' | 'expense'>('')
  const [accountId, setAccountId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editModel, setEditModel] = useState<EditableTransaction | null>(null)
  const queryClient = useQueryClient()

  const accounts = useAccounts()
  const { data, isLoading, isError } = useTransactions({
    limit: 200,
    page: 1,
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
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    },
  })

  const bulkImportMutation = useMutation({
    mutationFn: (items: BulkTxItem[]) =>
      bulkImportTransactions({
        account_id: accountId,
        items,
      }),
    onSuccess: () => {
      setBulkInput('')
      setBulkError(null)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
    },
    onError: () => {
      setBulkError('Failed to import income and expenses.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (params: { transactionId: string; payload: { amount: number; description?: string; category?: string; date?: string } }) =>
      updateTransaction(params.transactionId, params.payload),
    onSuccess: () => {
      setEditingId(null)
      setEditModel(null)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
    },
  })

  const totalIn = rows.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalOut = rows.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)

  const csvTemplate = useMemo(
    () => 'description,amount,category,date,type,notes\nCoffee,8.50,Food,2026-04-05,expense,Morning coffee\nPaycheck,2500,Income,2026-04-01,income,April payroll',
    [],
  )

  async function handleBulkFileUpload(file: File) {
    setBulkError(null)
    if (!accountId) {
      setBulkError('Select an account before importing.')
      return
    }

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let rows: string[][] = []

      if (ext === 'csv') {
        const text = await file.text()
        rows = parseCsvTextRows(text)
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 })
        rows = data.map((row) => row.map((cell) => String(cell ?? '').trim()))
      } else {
        throw new Error('Only .csv, .xlsx, or .xls files are supported.')
      }

      const parsed = parseStrictTransactionRows(rows)
      bulkImportMutation.mutate(parsed)
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Failed to parse file.')
    }
  }

  return (
    <div className="app-page">
      <div className="flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="section-kicker mb-2">All</p>
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
            className="font-mono text-xs px-3 py-1.5 rounded border border-coral/40 text-coral/90 hover:bg-coral/10 transition-colors disabled:opacity-50"
          >
            {resetMutation.isPending ? 'Resetting...' : 'Reset'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="font-mono text-xs px-4 py-2.5 rounded-lg border border-gold/40 text-gold bg-gold-faint hover:bg-gold/20 transition-colors whitespace-nowrap"
          >
            + add income or expense
          </button>
        </div>
      </div>

      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} />}

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

      <Card className="animate-fade-up delay-2">
        <p className="font-mono text-xs text-parchment-dim mb-2">Bulk import income and expenses</p>
        <p className="font-mono text-xs text-parchment-dim mb-2">
          Strict format required: description,amount,category,date,type,notes
        </p>
        <textarea
          value={bulkInput}
          onChange={(event) => setBulkInput(event.target.value)}
          placeholder={csvTemplate}
          rows={5}
        />
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="font-mono text-xs text-parchment-dim inline-flex items-center gap-2">
            <span>Import CSV/XLSX file:</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  handleBulkFileUpload(file)
                }
                event.currentTarget.value = ''
              }}
              className="text-xs"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setBulkError(null)
              if (!accountId) {
                setBulkError('Select an account before importing income and expenses.')
                return
              }

              try {
                const parsed = parseStrictTransactionRows(parseCsvTextRows(bulkInput))
                bulkImportMutation.mutate(parsed)
              } catch (error) {
                setBulkError(error instanceof Error ? error.message : 'Failed to parse pasted rows.')
              }
            }}
            disabled={bulkImportMutation.isPending}
            className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
          >
            {bulkImportMutation.isPending ? 'Importing...' : 'Import Income/Expenses'}
          </button>
        </div>
        {bulkError ? <p className="font-mono text-xs text-coral mt-2">{bulkError}</p> : null}
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
                  isEditing={editingId === tx.id}
                  editable={editModel}
                  isSaving={updateMutation.isPending && editingId === tx.id}
                  isDeleting={deleteMutation.isPending}
                  onStartEdit={(row) => {
                    setEditingId(row.id)
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
                  }}
                  onChangeEdit={setEditModel}
                  onSaveEdit={(row) => {
                    if (!editModel) return
                    const parsedAmount = Number(editModel.amount)
                    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                      return
                    }

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
                  onDelete={(row) => {
                    const confirmed = window.confirm('Delete this income/expense entry?')
                    if (!confirmed) {
                      return
                    }
                    deleteMutation.mutate(row.id)
                  }}
                />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
