import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchActivebudget, resetBudget, exportBudget, createBudget } from '@/api/budgets'
import { Card, EmptyState, Spinner } from '@/components/ui'
import type { BudgetWithSpent } from '@/api/budgets'
import type { BudgetCategoryInput } from '@/api/budgets'
import type { AxiosError } from 'axios'

const BUDGET_IMPORT_TEMPLATE =
  'category,amount\nGroceries,500\nRent,800\nTransport,200\n'

function downloadBudgetTemplate() {
  const blob = new Blob([BUDGET_IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'budget-template.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function parseCsvRows(rawText: string): string[][] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.trim()))
}

function parseBudgetRows(rows: string[][]): BudgetCategoryInput[] {
  if (rows.length === 0) {
    throw new Error('Add at least one subcategory row in the format: category,amount')
  }

  const firstRow = rows[0].map((cell) => cell.toLowerCase())
  const hasHeader = firstRow[0] === 'category' && firstRow[1] === 'amount'

  const dataRows = (hasHeader ? rows.slice(1) : rows).filter((row) =>
    row.some((cell) => cell.length > 0),
  )
  if (dataRows.length === 0) {
    throw new Error('No data rows found.')
  }

  const categories: BudgetCategoryInput[] = []
  for (let i = 0; i < dataRows.length; i++) {
    const lineNumber = i + 2
    const row = dataRows[i]
    const categoryName = String(row[0] ?? '').trim()
    const categoryAmountRaw = String(row[1] ?? '').trim()

    if (!categoryName) throw new Error(`Row ${lineNumber}: category name is required.`)
    const categoryAmount = Number(categoryAmountRaw)
    if (!Number.isFinite(categoryAmount) || categoryAmount < 0) {
      throw new Error(`Row ${lineNumber}: amount must be a non-negative number.`)
    }
    categories.push({ name: categoryName, amount: categoryAmount })
  }

  if (categories.length === 0) {
    throw new Error('At least one category row is required.')
  }

  return categories
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function BudgetPage() {
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [budgetName, setBudgetName] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [categories, setCategories] = useState<BudgetCategoryInput[]>([
    { name: '', amount: 0 },
  ])
  const [error, setError] = useState<string | null>(null)
  const [createdBudgetFallback, setCreatedBudgetFallback] = useState<BudgetWithSpent | null>(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkName, setBulkName] = useState('')
  const [bulkTotalAmount, setBulkTotalAmount] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [bulkError, setBulkError] = useState<string | null>(null)

  const { data: activeBudget, isLoading, isError } = useQuery({
    queryKey: ['active-budget'],
    queryFn: fetchActivebudget,
  })

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; total_amount: number; categories?: BudgetCategoryInput[] }) =>
      createBudget(payload),
    onSuccess: (createdBudget, variables) => {
      setBudgetName('')
      setBudgetAmount('')
      setCategories([{ name: '', amount: 0 }])
      setError(null)
      setShowCreateForm(false)
      const createdAsActive: BudgetWithSpent = {
        ...createdBudget,
        name: variables.name,
        total_amount: variables.total_amount,
        spent_amount: 0,
        categories: (variables.categories ?? []).map((category) => ({
          name: category.name,
          limit: category.amount,
          spent: 0,
          remaining: category.amount,
        })),
      }
      setCreatedBudgetFallback(createdAsActive)
      queryClient.setQueryData(['active-budget'], createdAsActive)
    },
    onError: (error: Error) => {
      console.error('Budget creation full error:', error)
      
      // Extract error details from axios error
      let errorMessage = 'Failed to create budget.'
      const axiosError = error as AxiosError<{ detail?: string | unknown[] }>
      
      if (axiosError?.response?.status === 422) {
        // Pydantic validation error
        const details = axiosError?.response?.data?.detail
        if (Array.isArray(details)) {
          errorMessage = details.map((d: unknown) => {
            if (typeof d === 'string') return d
            if (d && typeof d === 'object') {
              const item = d as { msg?: string; loc?: Array<string | number> }
              if (item.msg) return `${item.loc?.join('.')}: ${item.msg}`
            }
            return JSON.stringify(d)
          }).join(', ')
        } else if (typeof details === 'string') {
          errorMessage = details
        }
      } else if (typeof axiosError?.response?.data?.detail === 'string') {
        errorMessage = axiosError.response.data.detail
      } else if (axiosError?.message) {
        errorMessage = axiosError.message
      }
      
      setError(`Error: ${errorMessage}`)
    },
  })

  const resetMutation = useMutation({
    mutationFn: (budgetId: string) => resetBudget(budgetId),
    onSuccess: () => {
      setError(null)
      setCreatedBudgetFallback(null)
      queryClient.invalidateQueries({ queryKey: ['active-budget'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
    },
    onError: () => {
      setError('Failed to reset budget.')
    },
  })

  const exportMutation = useMutation({
    mutationFn: (budgetId: string) => exportBudget(budgetId),
    onSuccess: (data) => {
      // Download the exported data as JSON
      const element = document.createElement('a')
      const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      element.href = URL.createObjectURL(file)
      element.download = `budget-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    },
    onError: () => {
      setError('Failed to export budget.')
    },
  })

  function handleBulkPasteImport() {
    setBulkError(null)
    try {
      if (!bulkName.trim()) throw new Error('Budget name is required.')
      const totalAmount = Number(bulkTotalAmount)
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        throw new Error('Total budget amount must be a number greater than 0.')
      }
      const categories = parseBudgetRows(parseCsvRows(bulkInput))
      const allocatedTotal = categories.reduce((sum, cat) => sum + cat.amount, 0)
      if (allocatedTotal > totalAmount) {
        throw new Error(`Category totals (${allocatedTotal}) exceed the total budget amount (${totalAmount}).`)
      }
      createMutation.mutate({ name: bulkName.trim(), total_amount: totalAmount, categories })
      setShowBulkImport(false)
      setBulkInput('')
      setBulkName('')
      setBulkTotalAmount('')
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to parse pasted rows.')
    }
  }

  const remaining = useMemo(() => {
    const displayedBudget = activeBudget ?? createdBudgetFallback
    if (!displayedBudget) return 0
    return (displayedBudget.total_amount ?? 0) - (displayedBudget.spent_amount ?? 0)
  }, [activeBudget, createdBudgetFallback])

  const percentUsed = useMemo(() => {
    const displayedBudget = activeBudget ?? createdBudgetFallback
    if (!displayedBudget || !displayedBudget.total_amount) return 0
    return ((displayedBudget.spent_amount ?? 0) / displayedBudget.total_amount) * 100
  }, [activeBudget, createdBudgetFallback])

  const displayedBudget = activeBudget ?? createdBudgetFallback
  const categoriesTotal = categories.reduce((sum, category) => sum + (Number(category.amount) || 0), 0)
  const unallocated = Math.max(0, Number(budgetAmount || 0) - categoriesTotal)

  const addCategoryRow = () => {
    setCategories((prev) => [...prev, { name: '', amount: 0 }])
  }

  const removeCategoryRow = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index))
  }

  const updateCategoryName = (index: number, value: string) => {
    setCategories((prev) =>
      prev.map((item, i) => (i === index ? { ...item, name: value } : item)),
    )
  }

  const updateCategoryAmount = (index: number, value: string) => {
    const parsed = Number(value)
    setCategories((prev) =>
      prev.map((item, i) => (i === index ? { ...item, amount: Number.isNaN(parsed) ? 0 : parsed } : item)),
    )
  }

  return (
    <div className="app-page">
      <div className="animate-fade-up flex items-end justify-between gap-4">
        <div>
          <p className="section-kicker mb-2">Budget</p>
          <h1
            className="font-display text-4xl md:text-5xl text-parchment leading-none"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
          >
            Budget Control
          </h1>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <p className="text-sm font-mono text-coral">Failed to load budget.</p>
      ) : !displayedBudget && !showCreateForm && !showBulkImport ? (
        <Card className="animate-fade-up delay-1 text-center py-8">
          <EmptyState message="No active budget yet. Create one to track your spending." />
          <div className="flex gap-2 justify-center mt-4">
            <button
              onClick={() => setShowCreateForm(true)}
              className="font-mono text-xs px-4 py-2.5 rounded-lg bg-gold text-ink font-medium hover:bg-gold-dim transition-colors"
            >
              Create Budget
            </button>
            <button
              onClick={() => setShowBulkImport(true)}
              className="font-mono text-xs px-4 py-2.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition-colors"
            >
              Import Budget
            </button>
          </div>
        </Card>
      ) : showBulkImport ? (
        <Card className="animate-fade-up delay-1">
          <p className="font-mono text-xs text-parchment-dim mb-4">Import Budget</p>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-mono text-parchment-dim mb-1">Budget Name</label>
              <input
                type="text"
                value={bulkName}
                onChange={(e) => setBulkName(e.target.value)}
                placeholder="e.g. April Household Budget"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-parchment-dim mb-1">Total Budget Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={bulkTotalAmount}
                onChange={(e) => setBulkTotalAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <p className="font-mono text-xs text-parchment-dim mb-1">Subcategories</p>
          <p className="font-mono text-xs text-parchment-dim mb-2">
            Format: category,amount (one per line, header optional)
          </p>
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            rows={5}
            placeholder="Groceries,500&#10;Rent,800&#10;Transport,200"
          />
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadBudgetTemplate}
                className="font-mono text-xs px-3 py-1.5 rounded border border-ink-border text-parchment-dim hover:text-parchment transition-colors"
              >
                Download Template
              </button>
              <button
                type="button"
                onClick={handleBulkPasteImport}
                disabled={createMutation.isPending}
                className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Importing...' : 'Import Budget'}
              </button>
              <button
                type="button"
                onClick={() => { setShowBulkImport(false); setBulkInput(''); setBulkName(''); setBulkTotalAmount(''); setBulkError(null) }}
                className="font-mono text-xs px-3 py-1.5 rounded border border-ink-border text-parchment-dim hover:text-parchment transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          {bulkError ? <p className="font-mono text-xs text-coral mt-2">{bulkError}</p> : null}
        </Card>
      ) : showCreateForm ? (
        <Card className="animate-fade-up delay-1">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              if (!budgetName.trim()) {
                setError('Budget name is required.')
                return
              }
              if (!budgetAmount || Number(budgetAmount) <= 0) {
                setError('Total budget amount must be greater than 0.')
                return
              }

              const validCategories = categories
                .map((category) => ({
                  name: category.name.trim(),
                  amount: Number(category.amount),
                }))
                .filter((category) => category.name.length > 0 && category.amount > 0)

              if (validCategories.length === 0) {
                setError('Add at least one category with a valid amount.')
                return
              }

              const totalAmount = Number(budgetAmount)
              const allocatedAmount = validCategories.reduce(
                (sum, category) => sum + category.amount,
                0,
              )
              if (allocatedAmount > totalAmount) {
                setError('Category totals cannot exceed the total budget amount.')
                return
              }

              createMutation.mutate({
                name: budgetName.trim(),
                total_amount: totalAmount,
                categories: validCategories,
              })
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-mono text-parchment-dim mb-2">Budget Name</label>
              <input
                type="text"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                placeholder="e.g. April Household Budget"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-mono text-parchment-dim mb-2">Total Budget Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="rounded-lg border border-ink-border bg-ink-card/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-xs text-parchment-dim">Subcategories</p>
                <button
                  type="button"
                  onClick={addCategoryRow}
                  className="font-mono text-xs px-2.5 py-1.5 rounded border border-ink-border text-parchment hover:bg-ink-card transition-colors"
                >
                  Add Category
                </button>
              </div>

              <div className="space-y-2">
                {categories.map((category, index) => (
                  <div key={`category-row-${index}`} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-7"
                      type="text"
                      value={category.name}
                      onChange={(e) => updateCategoryName(index, e.target.value)}
                      placeholder="Category name"
                    />
                    <input
                      className="col-span-4"
                      type="number"
                      step="0.01"
                      min="0"
                      value={category.amount || ''}
                      onChange={(e) => updateCategoryAmount(index, e.target.value)}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => removeCategoryRow(index)}
                      className="col-span-1 text-coral text-xs"
                      aria-label="Remove category"
                      disabled={categories.length === 1}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>

              <p className="font-mono text-[11px] text-parchment-dim mt-2">
                Allocated: {fmt(categoriesTotal)} | Unallocated: {fmt(unallocated)}
              </p>
            </div>
            {error && <p className="font-mono text-xs text-coral">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="font-mono text-xs px-4 py-2.5 rounded-lg bg-gold text-ink font-medium hover:bg-gold-dim transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving...' : 'Save Category Budget'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setBudgetName('')
                  setBudgetAmount('')
                  setCategories([{ name: '', amount: 0 }])
                  setError(null)
                }}
                className="font-mono text-xs px-4 py-2.5 rounded-lg border border-ink-border text-parchment hover:bg-ink-card transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      ) : displayedBudget ? (
        <>
          <Card className="animate-fade-up delay-1">
            <div className="mb-6">
              <p className="font-mono text-xs text-parchment-dim mb-1">Active Budget</p>
              <h2 className="text-2xl font-bold text-parchment mb-4">{displayedBudget.name}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="rounded-lg border border-ink-border bg-ink-card/50 px-4 py-3.5 text-center">
                  <p className="text-xs text-parchment-dim mb-1">Total Budgeted</p>
                  <p className="text-parchment text-lg font-mono">{fmt(displayedBudget.total_amount ?? 0)}</p>
                </div>
                <div className="rounded-lg border border-coral/20 bg-coral/5 px-4 py-3.5 text-center">
                  <p className="text-xs text-parchment-dim mb-1">Spent</p>
                  <p className="text-coral text-lg font-mono">{fmt(displayedBudget.spent_amount ?? 0)}</p>
                </div>
                <div className={`rounded-lg border px-4 py-3.5 text-center ${remaining >= 0 ? 'border-jade/20 bg-jade/5' : 'border-coral/20 bg-coral/5'}`}>
                  <p className="text-xs text-parchment-dim mb-1">Remaining</p>
                  <p className={`text-lg font-mono ${remaining >= 0 ? 'text-jade' : 'text-coral'}`}>
                    {fmt(remaining)}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-mono text-xs text-parchment-dim">Spending Progress</p>
                  <p className="font-mono text-xs text-parchment">{percentUsed.toFixed(1)}%</p>
                </div>
                <div className="w-full h-2 rounded-full bg-ink-border overflow-hidden">
                  <div
                    className={`h-full transition-all ${percentUsed >= 100 ? 'bg-coral' : percentUsed >= 75 ? 'bg-gold' : 'bg-jade'}`}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  />
                </div>
              </div>

              {displayedBudget.categories && displayedBudget.categories.length > 0 ? (
                <div className="rounded-lg border border-ink-border bg-ink-card/30 p-3 mb-4">
                  <p className="font-mono text-xs text-parchment-dim mb-2">Category Breakdown</p>
                  <div className="space-y-2">
                    {displayedBudget.categories.map((cat) => (
                      <div key={`${cat.name}-${cat.limit}`} className="flex items-center justify-between text-sm">
                        <span className="text-parchment">{cat.name}</span>
                        <span className="font-mono text-parchment-dim">
                          {fmt(cat.spent ?? 0)}/{fmt(cat.limit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {error && <p className="font-mono text-xs text-coral mb-4">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="font-mono text-xs px-4 py-2.5 rounded-lg border border-ink-border text-parchment hover:bg-ink-card transition-colors"
              >
                Add Category Budget
              </button>
              <button
                type="button"
                onClick={() => { setShowBulkImport(true); setBulkError(null) }}
                className="font-mono text-xs px-4 py-2.5 rounded-lg border border-ink-border text-parchment hover:bg-ink-card transition-colors"
              >
                Import Budget
              </button>
              <button
                type="button"
                onClick={() => {
                  exportMutation.mutate(displayedBudget.id)
                }}
                disabled={exportMutation.isPending}
                className="font-mono text-xs px-4 py-2.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
              >
                {exportMutation.isPending ? 'Exporting...' : 'Export'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm(
                    `Reset "${displayedBudget.name}"? You'll have the option to export the current budget and transactions.`,
                  )
                  if (!confirmed) return
                  resetMutation.mutate(displayedBudget.id)
                }}
                disabled={resetMutation.isPending}
                className="font-mono text-xs px-4 py-2.5 rounded-lg border border-coral/40 text-coral hover:bg-coral/10 transition-colors disabled:opacity-50"
              >
                {resetMutation.isPending ? 'Resetting...' : 'Reset & Start New'}
              </button>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}
