import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createLoan, deleteLoan, type Loan } from '@/api/loans'
import { useLoans } from '@/components/hooks/useLoans'
import { Card, EmptyState, Spinner } from '@/components/ui'

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function getProgressPercentage(loan: Loan) {
  if (loan.principal_amount <= 0) {
    return 0
  }

  return Math.max(
    0,
    Math.min(100, ((loan.principal_amount - loan.current_balance) / loan.principal_amount) * 100),
  )
}

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-border/80">
      <div
        className="h-full rounded-full bg-gold transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

function LoanCard({ loan, onDelete }: { loan: Loan; onDelete: (loanId: string) => void }) {
  const progress = getProgressPercentage(loan)
  const paidAmount = Math.max(0, loan.principal_amount - loan.current_balance)

  return (
    <Card className="animate-fade-up delay-2 w-full px-6 py-6 md:px-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="section-kicker mb-2">Debt</p>
          <h2 className="font-display text-3xl text-parchment leading-none italic md:text-4xl">{loan.name}</h2>
          <p className="mt-3 font-mono text-xs leading-relaxed text-parchment-dim md:text-sm">
            {loan.start_date ? `Started ${format(parseISO(loan.start_date), 'MMM d, yyyy')}` : 'No start date set'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(loan.id)}
          className="self-start rounded-lg border border-coral/30 px-3 py-2 font-mono text-xs text-coral transition-colors hover:bg-coral/10"
        >
          Delete
        </button>
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex flex-col gap-2 font-mono text-xs text-parchment-dim sm:flex-row sm:items-center sm:justify-between">
          <span>Progress</span>
          <span className="text-parchment">{progress.toFixed(1)}% paid off</span>
        </div>
        <ProgressBar percentage={progress} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-h-28 flex-col justify-between rounded-lg border border-ink-border bg-ink-card/50 px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-parchment-dim">Starting amount</p>
          <p className="mt-4 font-mono text-xl leading-none text-parchment md:text-2xl">{fmt(loan.principal_amount)}</p>
        </div>
        <div className="flex min-h-28 flex-col justify-between rounded-lg border border-ink-border bg-ink-card/50 px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-parchment-dim">Current amount</p>
          <p className="mt-4 font-mono text-xl leading-none text-parchment md:text-2xl">{fmt(loan.current_balance)}</p>
        </div>
        <div className="flex min-h-28 flex-col justify-between rounded-lg border border-jade/20 bg-jade/5 px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-parchment-dim">Paid down</p>
          <p className="mt-4 font-mono text-xl leading-none text-jade md:text-2xl">{fmt(paidAmount)}</p>
        </div>
        <div className="flex min-h-28 flex-col justify-between rounded-lg border border-gold/20 bg-gold-faint px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-parchment-dim">Interest rate</p>
          <p className="mt-4 font-mono text-xl leading-none text-gold md:text-2xl">{loan.interest_rate.toFixed(2)}%</p>
        </div>
      </div>
    </Card>
  )
}

export default function LoansPage() {
  const { data: loans, isLoading } = useLoans()
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    principal_amount: '',
    current_balance: '',
    interest_rate: '',
    start_date: '',
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createLoan({
        name: formData.name.trim(),
        principal_amount: Number(formData.principal_amount),
        current_balance: Number(formData.current_balance),
        interest_rate: Number(formData.interest_rate),
        start_date: formData.start_date || undefined,
      }),
    onSuccess: () => {
      setFormData({ name: '', principal_amount: '', current_balance: '', interest_rate: '', start_date: '' })
      setShowCreateForm(false)
      queryClient.invalidateQueries({ queryKey: ['loans'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
    },
  })

  return (
    <div className="app-page">
      <div className="flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="section-kicker mb-2">Track</p>
          <h1
            className="font-display text-4xl md:text-5xl text-parchment leading-none"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
          >
            Loans
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((value) => !value)}
          className="rounded-lg border border-gold/40 bg-gold-faint px-4 py-2.5 font-mono text-xs text-gold transition-colors hover:bg-gold/20"
        >
          {showCreateForm ? 'Close form' : '+ add loan'}
        </button>
      </div>

      {showCreateForm ? (
        <Card className="animate-fade-up delay-1">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              createMutation.mutate()
            }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <label className="flex flex-col gap-1.5 md:col-span-1">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Loan name *</span>
              <input
                required
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                placeholder="Student Loan"
              />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-1">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Starting amount *</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={formData.principal_amount}
                onChange={(event) => setFormData((current) => ({ ...current, principal_amount: event.target.value }))}
                placeholder="25000"
              />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-1">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Current amount *</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formData.current_balance}
                onChange={(event) => setFormData((current) => ({ ...current, current_balance: event.target.value }))}
                placeholder="18250"
              />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-1">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Interest rate *</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formData.interest_rate}
                onChange={(event) => setFormData((current) => ({ ...current, interest_rate: event.target.value }))}
                placeholder="4.75"
              />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-1">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Start date</span>
              <input
                type="date"
                value={formData.start_date}
                onChange={(event) => setFormData((current) => ({ ...current, start_date: event.target.value }))}
              />
            </label>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-gold px-4 py-2.5 font-mono text-xs font-medium text-ink transition-colors hover:bg-gold-dim disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create Loan'}
              </button>
            </div>
          </form>
          <p className="mt-4 font-mono text-xs text-parchment-dim">
            Enter the original principal, your remaining balance today, and the current interest rate so tracking starts from your real position.
          </p>
        </Card>
      ) : null}

      {isLoading ? (
        <Spinner />
      ) : !loans || loans.length === 0 ? (
        <EmptyState message="No loans yet. Add one to start tracking payoff progress." />
      ) : (
        <div className="flex flex-col gap-5">
          {loans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onDelete={(loanId) => {
                const confirmed = window.confirm('Delete this loan and its payment history?')
                if (!confirmed) {
                  return
                }
                deleteMutation.mutate(loanId)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
