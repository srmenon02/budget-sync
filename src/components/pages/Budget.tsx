import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { upsertBudget } from '@/api/budgets'
import { useBudgets } from '@/components/hooks/useBudgets'
import { Card, Spinner, EmptyState } from '@/components/ui'

const DEFAULT_CATEGORIES = [
	'Groceries',
	'Dining',
	'Transportation',
	'Utilities',
	'Healthcare',
	'Entertainment',
	'Other',
]

type Timeframe = 'this_week' | 'this_month' | 'this_quarter' | 'this_year'

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
	this_week: 'This Week',
	this_month: 'This Month',
	this_quarter: 'This Quarter',
	this_year: 'This Year',
}

function getDateRange(tf: Timeframe): { month: string; startDate?: string; endDate?: string } {
	const now = new Date()
	const month = now.toISOString().slice(0, 7)

	if (tf === 'this_month') return { month }

	if (tf === 'this_week') {
		const start = new Date(now)
		start.setDate(now.getDate() - now.getDay())
		const end = new Date(start)
		end.setDate(start.getDate() + 7)
		return { month, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
	}

	if (tf === 'this_quarter') {
		const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
		const qEnd = new Date(qStart)
		qEnd.setMonth(qEnd.getMonth() + 3)
		return { month, startDate: qStart.toISOString().slice(0, 10), endDate: qEnd.toISOString().slice(0, 10) }
	}

	// this_year
	return {
		month,
		startDate: `${now.getFullYear()}-01-01`,
		endDate: `${now.getFullYear() + 1}-01-01`,
	}
}

function fmt(amount: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function BudgetPage() {
	const [timeframe, setTimeframe] = useState<Timeframe>('this_month')
	const { month, startDate, endDate } = getDateRange(timeframe)
	const queryClient = useQueryClient()
	const budgetsQuery = useBudgets(month, startDate, endDate)

	const [category, setCategory] = useState(DEFAULT_CATEGORIES[0])
	const [amount, setAmount] = useState('')
	const [editingCategory, setEditingCategory] = useState<string | null>(null)
	const [editingAmount, setEditingAmount] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [editError, setEditError] = useState<string | null>(null)

	const mutation = useMutation({
		mutationFn: () => upsertBudget({ category: category.trim(), amount: Number(amount), month }),
		onSuccess: () => {
			setAmount('')
			setCategory(DEFAULT_CATEGORIES[0])
			setError(null)
			queryClient.invalidateQueries({ queryKey: ['budgets', month] })
		},
		onError: () => {
			setError('Failed to save budget.')
		},
	})

	const editMutation = useMutation({
		mutationFn: (payload: { category: string; amount: number; month: string }) => upsertBudget(payload),
		onSuccess: () => {
			setEditingCategory(null)
			setEditingAmount('')
			setEditError(null)
			queryClient.invalidateQueries({ queryKey: ['budgets', month] })
		},
		onError: () => {
			setEditError('Failed to update budget item.')
		},
	})

	const rows = budgetsQuery.data ?? []
	const categoryOptions = useMemo(() => {
		const existing = rows.map((row) => row.category)
		return Array.from(new Set([...DEFAULT_CATEGORIES, ...existing])).sort((a, b) => a.localeCompare(b))
	}, [rows])

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
					<p className="section-kicker mb-2">{TIMEFRAME_LABELS[timeframe]}</p>
					<h1
						className="font-display text-4xl md:text-5xl text-parchment leading-none"
						style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
					>
						Budget
					</h1>
				</div>
				<div className="flex items-center gap-1 pb-1">
					{(Object.keys(TIMEFRAME_LABELS) as Timeframe[]).map((tf) => (
						<button
							key={tf}
							onClick={() => setTimeframe(tf)}
							className={`font-mono text-xs px-3 py-1.5 rounded-lg border transition-colors ${
								timeframe === tf
									? 'border-gold/60 text-gold bg-gold-faint'
									: 'border-ink-border text-parchment-dim hover:text-parchment hover:border-ink-border/80'
							}`}
						>
							{TIMEFRAME_LABELS[tf]}
						</button>
					))}
				</div>
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
					className="grid grid-cols-1 md:grid-cols-4 gap-3"
				>
					<>
						<input
							list="budget-categories"
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							placeholder="Category (e.g. Groceries)"
							required
						/>
						<datalist id="budget-categories">
							{categoryOptions.map((item) => (
								<option key={item} value={item} />
							))}
						</datalist>
					</>
					<input value={month} disabled className="opacity-70" />
					<input
						type="number"
						step="0.01"
						min="0"
						placeholder="Monthly limit"
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
					Use an existing category or type a new one to define your own budget categories.
				</p>
			</Card>

			{budgetsQuery.isLoading ? (
				<Spinner />
			) : budgetsQuery.isError ? (
				<p className="text-sm font-mono text-coral">Failed to load budgets.</p>
			) : rows.length === 0 ? (
				<EmptyState message="No budgets set for this month yet." />
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
												<p className="font-mono text-xs text-parchment-dim mt-1">Adjust monthly limit</p>
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
														editMutation.mutate({ category: row.category, amount: Number(editingAmount), month })
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
													Spent {fmt(row.spent)} of {fmt(row.limit)}
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
