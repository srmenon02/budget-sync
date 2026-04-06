import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'

import { bulkUpsertBudgets, resetCurrentBudgets, upsertBudget } from '@/api/budgets'
import { useBudgets } from '@/components/hooks/useBudgets'
import { Card, EmptyState, Spinner } from '@/components/ui'
import { useBudgetViewStore } from '@/stores/budgetViewStore'

const DEFAULT_CATEGORIES = [
  'Groceries',
  'Dining',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Other',
]

type BudgetPeriod = 'monthly' | 'paycheck'

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  monthly: 'Monthly',
  paycheck: 'Per Paycheck',
}

function getBudgetContext(period: BudgetPeriod): { month: string; helperText: string } {
  const now = new Date()
  const month = now.toISOString().slice(0, 7)

  if (period === 'paycheck') {
    return { month, helperText: 'Paycheck budgets only show categories for the active paycheck.' }
  }

  return { month, helperText: 'Monthly budgets compare against the full current month.' }
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function downloadTemplateFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function parseCsvTextRows(rawText: string): string[][] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.trim()))
}

function parseStrictBudgetRows(rows: string[][]): Array<{ category: string; amount: number }> {
  if (rows.length < 2) {
    throw new Error('File must include headers and at least one data row.')
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const expected = ['category', 'amount']
  if (header.length < expected.length || expected.some((value, index) => header[index] !== value)) {
    throw new Error('Invalid header. Expected: category,amount')
  }

  const parsed: Array<{ category: string; amount: number }> = []
  for (let i = 1; i < rows.length; i += 1) {
    const lineNumber = i + 1
    const row = rows[i]
    if (!row || row.every((cell) => !String(cell ?? '').trim())) {
      continue
    }

    const categoryName = String(row[0] ?? '').trim()
    const amountRaw = String(row[1] ?? '').trim()

    if (!categoryName) {
      throw new Error(`Line ${lineNumber}: category is required.`)
    }

    const amountValue = Number(amountRaw)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      throw new Error(`Line ${lineNumber}: amount must be a number greater than 0.`)
    }

    parsed.push({ category: categoryName, amount: amountValue })
  }

  if (parsed.length === 0) {
    throw new Error('No valid budget rows found.')
  }

  return parsed
}

export default function BudgetPage() {
  const period = useBudgetViewStore((state) => state.mode as BudgetPeriod)
  const { month, helperText } = getBudgetContext(period)
  const queryClient = useQueryClient()
  const budgetsQuery = useBudgets(month, period)

  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingAmount, setEditingAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const budgetTemplate = useMemo(() => 'category,amount\nGroceries,500\nTransportation,200', [])

  const mutation = useMutation({
    mutationFn: () => upsertBudget({ category: category.trim(), amount: Number(amount), month, period }),
    onSuccess: () => {
      setAmount('')
      setCategory(DEFAULT_CATEGORIES[0])
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['budgets', month, period] })
    },
    onError: () => {
      setError('Failed to save budget.')
    },
  })

  const bulkMutation = useMutation({
    mutationFn: (items: Array<{ category: string; amount: number }>) =>
      bulkUpsertBudgets({
        month,
        period,
        items,
      }),
    onSuccess: () => {
      setBulkInput('')
      setBulkError(null)
      queryClient.invalidateQueries({ queryKey: ['budgets', month, period] })
    },
    onError: () => {
      setBulkError('Failed to import budget categories.')
    },
  })

  const editMutation = useMutation({
    mutationFn: (payload: { category: string; amount: number; month: string; period: BudgetPeriod }) => upsertBudget(payload),
    onSuccess: () => {
      setEditingCategory(null)
      setEditingAmount('')
      setEditError(null)
      queryClient.invalidateQueries({ queryKey: ['budgets', month, period] })
    },
    onError: () => {
      setEditError('Failed to update budget item.')
    },
  })

  async function handleBudgetFileUpload(file: File) {
    setBulkError(null)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let rows: string[][] = []

      if (ext === 'csv') {
        rows = parseCsvTextRows(await file.text())
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 })
        rows = data.map((row) => row.map((cell) => String(cell ?? '').trim()))
      } else {
        throw new Error('Only .csv, .xlsx, or .xls files are supported.')
      }

      const parsed = parseStrictBudgetRows(rows)
      bulkMutation.mutate(parsed)
    } catch (uploadError) {
      setBulkError(uploadError instanceof Error ? uploadError.message : 'Failed to parse budget file.')
    }
  }

  const rows = useMemo(() => budgetsQuery.data?.budgets ?? [], [budgetsQuery.data?.budgets])
  const categoryOptions = useMemo(() => {
    const existing = rows.map((row) => row.category)
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...existing])).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredCategoryOptions = useMemo(() => {
    const q = category.trim().toLowerCase()
    if (!q) {
      return categoryOptions.slice(0, 8)
    }
    return categoryOptions.filter((item) => item.toLowerCase().includes(q)).slice(0, 8)
  }, [category, categoryOptions])

  const resetMutation = useMutation({
    mutationFn: () => resetCurrentBudgets(month, period),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      setEditingCategory(null)
      setEditingAmount('')
    },
    onError: () => {
      setError(`Failed to reset ${period} categories.`)
    },
  })

  const totals = useMemo(() => {
    const totalBudget = rows.reduce((sum, row) => sum + row.limit, 0)
    const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0)
    return {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
    }
  }, [rows])

  return (
    <div className="app-page">
      <div className="animate-fade-up flex items-end justify-between gap-4">
        <div>
          <p className="section-kicker mb-2">{PERIOD_LABELS[period]}</p>
          <h1
            className="font-display text-4xl md:text-5xl text-parchment leading-none"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
          >
            Budget
          </h1>
        </div>
        <p className="font-mono text-xs text-parchment-dim pb-1">Mode set from Overview tab</p>
      </div>

      <Card className="animate-fade-up delay-1">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            const trimmedCategory = category.trim()
            if (!trimmedCategory) {
              setError('Category is required.')
              return
            }
            if (!amount || Number(amount) <= 0) {
              setError('Budget amount must be greater than 0.')
              return
            }
            mutation.mutate()
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="relative">
            <input
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setShowCategorySuggestions(true)
              }}
              onFocus={() => setShowCategorySuggestions(true)}
              onBlur={() => {
                window.setTimeout(() => setShowCategorySuggestions(false), 120)
              }}
              placeholder="Category (e.g. Groceries)"
              autoComplete="off"
              required
            />
            {showCategorySuggestions && filteredCategoryOptions.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 rounded-md border border-ink-border bg-ink-raised shadow-lg overflow-hidden">
                {filteredCategoryOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onMouseDown={() => {
                      setCategory(item)
                      setShowCategorySuggestions(false)
                    }}
                    className="w-full text-left px-3 py-2 font-mono text-xs text-parchment hover:bg-ink-card transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={period === 'monthly' ? 'Monthly limit' : 'Per-paycheck limit'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <button
            type="submit"
            className="font-mono text-xs px-4 py-2.5 rounded-lg bg-gold text-ink font-medium hover:bg-gold-dim transition-colors disabled:opacity-50"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : 'Save Budget'}
          </button>
        </form>
        {error ? <p className="font-mono text-xs text-coral mt-3">{error}</p> : null}
        <p className="font-mono text-xs text-parchment-dim mt-3">
          Use an existing category or type a new one to define your own budget categories. {helperText}
        </p>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              const confirmed = window.confirm('Are you sure you want to reset these categories?')
              if (!confirmed) {
                return
              }
              setError(null)
              resetMutation.mutate()
            }}
            disabled={resetMutation.isPending}
            className="font-mono text-xs px-3 py-1.5 rounded border border-coral/40 text-coral/90 hover:bg-coral/10 transition-colors disabled:opacity-50"
          >
            {resetMutation.isPending ? 'Resetting...' : 'Reset'}
          </button>
        </div>

        <div className="mt-4 border-t border-ink-border/70 pt-4">
          <p className="font-mono text-xs text-parchment-dim mb-2">Bulk import categories</p>
          <textarea
            value={bulkInput}
            onChange={(event) => setBulkInput(event.target.value)}
            placeholder=""
            rows={4}
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
                    handleBudgetFileUpload(file)
                  }
                  event.currentTarget.value = ''
                }}
                className="text-xs"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadTemplateFile('budget-template.csv', budgetTemplate)}
                className="font-mono text-xs px-3 py-1.5 rounded border border-ink-border text-parchment-dim hover:text-parchment transition-colors"
              >
                Download Template
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkError(null)
                  try {
                    const parsed = parseStrictBudgetRows(parseCsvTextRows(bulkInput))
                    bulkMutation.mutate(parsed)
                  } catch (parseError) {
                    setBulkError(parseError instanceof Error ? parseError.message : 'Failed to parse pasted budget rows.')
                  }
                }}
                disabled={bulkMutation.isPending}
                className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
              >
                {bulkMutation.isPending ? 'Importing...' : 'Import Categories'}
              </button>
            </div>
          </div>
          {bulkError ? <p className="font-mono text-xs text-coral mt-2">{bulkError}</p> : null}
        </div>
      </Card>

      {budgetsQuery.isLoading ? (
        <Spinner />
      ) : budgetsQuery.isError ? (
        <p className="text-sm font-mono text-coral">Failed to load budgets.</p>
      ) : rows.length === 0 ? (
        <EmptyState message={period === 'monthly' ? 'No monthly budgets set for this month yet.' : 'No paycheck budgets set for the active paycheck yet.'} />
      ) : (
        <>
          <div className="animate-fade-up delay-2 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="font-mono rounded-lg border border-ink-border bg-ink-card/50 px-4 py-3.5 text-center">
              <p className="text-xs text-parchment-dim mb-1">Budgeted</p>
              <p className="text-parchment text-lg">{fmt(totals.totalBudget)}</p>
            </div>
            <div className="font-mono rounded-lg border border-coral/20 bg-coral/5 px-4 py-3.5 text-center">
              <p className="text-xs text-parchment-dim mb-1">Spent</p>
              <p className="text-coral text-lg">{fmt(totals.totalSpent)}</p>
            </div>
            <div className="font-mono rounded-lg border border-jade/20 bg-jade/5 px-4 py-3.5 text-center">
              <p className="text-xs text-parchment-dim mb-1">Remaining</p>
              <p className="text-jade text-lg">{fmt(totals.totalRemaining)}</p>
            </div>
          </div>

          <Card className="animate-fade-up delay-3 p-0 overflow-hidden">
            <div className="px-5 md:px-6">
              {rows.map((row) => (
                <div key={row.category} className="py-4 border-b border-ink-border/60 last:border-0 flex items-center justify-between">
                  {editingCategory === row.category ? (
                    <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 justify-between">
                      <div>
                        <p className="font-mono text-sm text-parchment">{row.category}</p>
                        <p className="font-mono text-xs text-parchment-dim mt-1">
                          Adjust {row.period === 'monthly' ? 'monthly' : 'paycheck'} limit
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingAmount}
                          onChange={(e) => setEditingAmount(e.target.value)}
                          className="w-32"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditError(null)
                            if (!editingAmount || Number(editingAmount) <= 0) {
                              setEditError('Budget amount must be greater than 0.')
                              return
                            }
                            editMutation.mutate({ category: row.category, amount: Number(editingAmount), month, period })
                          }}
                          disabled={editMutation.isPending}
                          className="font-mono text-xs px-3 py-2 rounded-lg bg-gold text-ink hover:bg-gold-dim transition-colors disabled:opacity-50"
                        >
                          {editMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(null)
                            setEditingAmount('')
                            setEditError(null)
                          }}
                          className="font-mono text-xs px-3 py-2 rounded-lg border border-ink-border text-parchment-muted hover:text-parchment transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-mono text-sm text-parchment">{row.category}</p>
                        <p className="font-mono text-xs text-parchment-dim mt-1">
                          Spent {fmt(row.spent)} of {fmt(row.limit)} · {row.period === 'monthly' ? 'Monthly' : 'Paycheck'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <p className={`font-mono text-sm ${row.over_budget ? 'text-coral' : 'text-jade'}`}>
                          {fmt(row.remaining)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(row.category)
                            setEditingAmount(String(row.limit))
                            setEditError(null)
                          }}
                          className="font-mono text-xs px-3 py-2 rounded-lg border border-gold/40 text-gold bg-gold-faint hover:bg-gold/20 transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {editError ? <p className="font-mono text-xs text-coral px-5 md:px-6 py-3 border-t border-ink-border/60">{editError}</p> : null}
          </Card>
        </>
      )}
    </div>
  )
}
