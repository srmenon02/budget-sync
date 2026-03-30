import { useAccounts } from '@/components/hooks/useAccounts'
import { useTransactions } from '@/components/hooks/useTransactions'
import { Card, Spinner, Badge, EmptyState } from '@/components/ui'
import type { FinancialAccount, Transaction } from '@/components/index'

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
  const accounts = useAccounts()
  const transactions = useTransactions(10)

  const totalBalance = (accounts.data ?? []).reduce((sum, a) => {
    return sum + (a.current_balance ?? 0)
  }, 0)

  const totalExpenses = (transactions.data ?? [])
    .filter(t => (t.amount ?? 0) < 0)
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)

  return (
    <div className="app-page">
      {/* Header */}
      <div className="animate-fade-up">
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

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 animate-fade-up delay-1">
        <Card className="border-gold/20 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{ background: 'radial-gradient(circle at 80% 50%, #e8b84b, transparent 70%)' }}
          />
          <p className="section-kicker mb-2 relative">Net Worth</p>
          <p
            className="font-display text-3xl md:text-[2.1rem] text-gold relative"
            style={{ fontVariationSettings: '"opsz" 48, "wght" 500' }}
          >
            {fmt(totalBalance)}
          </p>
          <p className="font-mono text-xs text-parchment-dim mt-2 relative">
            {accounts.data?.length ?? 0} account{accounts.data?.length !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card>
          <p className="section-kicker mb-2">Recent Spend</p>
          <p
            className="font-display text-3xl md:text-[2.1rem] text-coral"
            style={{ fontVariationSettings: '"opsz" 48, "wght" 500' }}
          >
            {fmt(totalExpenses)}
          </p>
          <p className="font-mono text-xs text-parchment-dim mt-2">last 10 transactions</p>
        </Card>
      </div>

      {/* Accounts */}
      <section className="app-section animate-fade-up delay-2">
        <h2 className="section-kicker">Accounts</h2>
        {accounts.isLoading ? (
          <Spinner />
        ) : accounts.isError ? (
          <p className="text-sm font-mono text-coral">Failed to load accounts.</p>
        ) : accounts.data?.length === 0 ? (
          <EmptyState message="No accounts yet. Seed some data or connect a bank account." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {accounts.data!.map((a, i) => (
              <AccountCard key={a.id} account={a} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Recent transactions */}
      <section className="app-section animate-fade-up delay-3">
        <h2 className="section-kicker">Recent Transactions</h2>
        {transactions.isLoading ? (
          <Spinner />
        ) : transactions.isError ? (
          <p className="text-sm font-mono text-coral">Failed to load transactions.</p>
        ) : transactions.data?.length === 0 ? (
          <EmptyState message="No transactions yet." />
        ) : (
          <Card>
            {transactions.data!.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

