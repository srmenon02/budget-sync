import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useAccountSummary } from '@/components/hooks/useAccountSummary'
import { useBudgets } from '@/components/hooks/useBudgets'
import { useTransactions } from '@/components/hooks/useTransactions'
import { Card, Spinner, Badge, EmptyState } from '@/components/ui'
import type { FinancialAccount, Transaction } from '@/components/index'
import { useBudgetViewStore } from '@/stores/budgetViewStore'

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function AccountCard({ account, index }: { account: FinancialAccount; index: number }) {
  const delayClass = ['delay-1', 'delay-2', 'delay-3', 'delay-4', 'delay-5'][index] ?? 'delay-5'
  return (
    <div
      className={`rounded-xl border border-ink-border bg-ink-card p-5 flex flex-col gap-3.5 animate-fade-up ${delayClass} hover:border-gold/30 transition-colors duration-200`}
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-start justify-between">
        <span className="font-mono text-xs text-parchment-muted uppercase tracking-widest">
          {account.institution_name || 'Account'}
        </span>
        <Badge variant="default">{account.account_type}</Badge>
      </div>
      <div>
        <p className="font-display text-2xl text-parchment leading-tight"
          style={{ fontVariationSettings: '"opsz" 28, "wght" 400' }}>
          {account.current_balance != null ? fmt(account.current_balance) : '—'}
        </p>
        <p className="font-mono text-xs text-parchment-dim mt-1 truncate">{account.account_name}</p>
      </div>
      <div className="h-px bg-ink-border" />
      <span className={`font-mono text-xs ${account.sync_status === 'ok' || account.sync_status === 'manual' ? 'text-jade' : 'text-parchment-dim'}`}>
        ● {account.sync_status}
      </span>
    </div>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const amount = tx.amount ?? 0
  const isExpense = amount < 0
  return (
    <div className="flex items-center justify-between py-3 border-b border-ink-border/60 last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-mono text-sm text-parchment truncate">
          {tx.merchant_name ?? tx.description ?? 'Transaction'}
        </span>
        <span className="font-mono text-xs text-parchment-dim">
          {tx.category ? <span className="text-gold/70">{tx.category}</span> : null}
          {tx.category ? ' · ' : ''}
          {tx.transaction_date}
        </span>
      </div>
      <span className={`font-mono text-sm font-medium ml-4 shrink-0 ${isExpense ? 'text-coral' : 'text-jade'}`}>
        {fmt(amount)}
      </span>
    </div>
  )
}

export default function Dashboard() {
  const mode = useBudgetViewStore((state) => state.mode)
  const setMode = useBudgetViewStore((state) => state.setMode)
  const month = new Date().toISOString().slice(0, 7)
  const now = new Date()
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const day = now.getDate()
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const paycheckStart = day <= 15 ? `${month}-01` : `${month}-16`
  const paycheckEnd = day <= 15 ? `${month}-15` : `${month}-${String(lastDay).padStart(2, '0')}`

  const accountSummary = useAccountSummary()
  const budgets = useBudgets(month, mode)
  const transactions = useTransactions({
    limit: 25,
    page: 1,
    month: mode === 'monthly' ? month : undefined,
    start_date: mode === 'paycheck' ? paycheckStart : undefined,
    end_date: mode === 'paycheck' ? paycheckEnd : undefined,
    sort: 'date',
    sort_dir: 'desc',
  })

  const txRows = transactions.data?.transactions ?? []

  const chartRows = (budgets.data?.budgets ?? []).map((budget) => ({
    category: budget.category?.trim() ? budget.category : 'Uncategorized',
    budget: budget.limit,
    actual: budget.spent,
  }))
  const chartHeight = Math.max(280, chartRows.length * 46)

  const accountRows = accountSummary.data?.accounts ?? []

  return (
    <div className="app-page">
      {/* Header */}
      <div className="animate-fade-up flex items-end justify-between gap-4">
        <div>
          <p className="section-kicker mb-2">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1
            className="font-display text-4xl md:text-5xl text-parchment leading-none"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
          >
            Overview
          </h1>
        </div>
        <div className="flex items-center gap-1 pb-1">
          <button
            type="button"
            onClick={() => setMode('monthly')}
            className={`font-mono text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              mode === 'monthly'
                ? 'border-gold/60 text-gold bg-gold-faint'
                : 'border-ink-border text-parchment-dim hover:text-parchment hover:border-ink-border/80'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setMode('paycheck')}
            className={`font-mono text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              mode === 'paycheck'
                ? 'border-gold/60 text-gold bg-gold-faint'
                : 'border-ink-border text-parchment-dim hover:text-parchment hover:border-ink-border/80'
            }`}
          >
            Paycheck
          </button>
        </div>
      </div>

      {/* Accounts */}
      <section className="app-section animate-fade-up delay-1">
        <h2 className="section-kicker">Accounts</h2>
        {accountSummary.isLoading ? (
          <Spinner />
        ) : accountSummary.isError ? (
          <p className="text-sm font-mono text-coral">Failed to load accounts.</p>
        ) : accountRows.length === 0 ? (
          <EmptyState message="No accounts yet. Seed some data or connect a bank account." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {accountRows.map((a, i) => (
              <AccountCard key={a.id} account={a} index={i} />
            ))}
          </div>
        )}
      </section>

      <section className="app-section animate-fade-up delay-2">
        <h2 className="section-kicker">
          Budget vs Actual ({mode === 'monthly' ? month : `${paycheckStart} to ${paycheckEnd}`})
        </h2>
        {budgets.isLoading ? (
          <Spinner />
        ) : budgets.isError ? (
          <p className="text-sm font-mono text-coral">Failed to load budget data.</p>
        ) : chartRows.length === 0 ? (
          <EmptyState message="No budgets set yet for this month." />
        ) : (
          <Card>
            <div style={{ height: `${chartHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  layout="vertical"
                  margin={{ left: 18, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid stroke="#2f2f2f" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#a5a19a" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={130}
                    stroke="#a5a19a"
                    tick={{ fontSize: 11 }}
                    tickMargin={6}
                    tickFormatter={(value: string) => (value && value.trim() ? value : 'Uncategorized')}
                  />
                  <Tooltip />
                  <Bar dataKey="budget" fill="#d4a84a" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" fill="#d96f5f" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </section>

      {/* Recent transactions */}
      <section className="app-section animate-fade-up delay-3">
        <h2 className="section-kicker">Recent Transactions</h2>
        {transactions.isLoading ? (
          <Spinner />
        ) : transactions.isError ? (
          <p className="text-sm font-mono text-coral">Failed to load transactions.</p>
        ) : txRows.length === 0 ? (
          <EmptyState message="No transactions yet." />
        ) : (
          <Card>
            {txRows.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

