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

function fmt(amount: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function BudgetPage() {
	const month = new Date().toISOString().slice(0, 7)
	const queryClient = useQueryClient()
	const budgetsQuery = useBudgets(month)

	const [category, setCategory] = useState(DEFAULT_CATEGORIES[0])
	const [amount, setAmount] = useState('')
	const [error, setError] = useState<string | null>(null)

	const mutation = useMutation({
		mutationFn: () => upsertBudget({ category, amount: Number(amount), month }),
		onSuccess: () => {
			setAmount('')
			setError(null)
			queryClient.invalidateQueries({ queryKey: ['budgets', month] })
		},
		onError: () => {
			setError('Failed to save budget.')
		},
	})

	const rows = budgetsQuery.data ?? []
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
			<div className="animate-fade-up">
				<p className="section-kicker mb-2">Monthly</p>
				<h1
					className="font-display text-4xl md:text-5xl text-parchment leading-none"
					style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
				>
					Budget
				</h1>
			</div>

			<Card className="animate-fade-up delay-1">
				<form
					onSubmit={(e) => {
						e.preventDefault()
						setError(null)
						mutation.mutate()
					}}
					className="grid grid-cols-1 md:grid-cols-4 gap-3"
				>
					<select value={category} onChange={(e) => setCategory(e.target.value)}>
						{DEFAULT_CATEGORIES.map((item) => (
							<option key={item} value={item}>{item}</option>
						))}
					</select>
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
									<div>
										<p className="font-mono text-sm text-parchment">{row.category}</p>
										<p className="font-mono text-xs text-parchment-dim mt-1">
											Spent {fmt(row.spent)} of {fmt(row.limit)}
										</p>
									</div>
									<p className={`font-mono text-sm ${row.over_budget ? 'text-coral' : 'text-jade'}`}>
										{fmt(row.remaining)}
									</p>
								</div>
							))}
						</div>
					</Card>
				</>
			)}
		</div>
	)
}
