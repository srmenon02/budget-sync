import { useState } from 'react'
import { useAccounts } from '@/components/hooks/useAccounts'
import { useTransactions } from '@/components/hooks/useTransactions'
import { Card, Spinner, EmptyState } from '@/components/ui'
import { AddTransactionModal } from '@/components/features/AddTransactionModal'
import type { Transaction } from '@/components/index'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const amount = tx.amount ?? 0
  const isExpense = amount < 0
  return (
    <div className="flex items-center justify-between py-3.5 md:py-4 border-b border-ink-border/60 last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-mono text-sm text-parchment truncate">
          {tx.merchant_name ?? tx.description ?? 'Transaction'}
        </span>
        <div className="flex items-center gap-2">
          {tx.category ? (
            <span className="font-mono text-xs text-gold/70">{tx.category}</span>
          ) : null}
          <span className="font-mono text-xs text-parchment-dim">{tx.transaction_date}</span>
          {tx.is_manual ? (
            <span className="font-mono text-xs text-parchment-dim/50 border border-ink-border px-1 rounded">manual</span>
          ) : null}
        </div>
      </div>
      <span className={`font-mono text-sm font-medium ml-4 shrink-0 ${isExpense ? 'text-coral' : 'text-jade'}`}>
        {fmt(amount)}
      </span>
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
  const [showAdd, setShowAdd] = useState(false)

  const accounts = useAccounts()
  const { data, isLoading, isError } = useTransactions({
    limit: 200,
    page: 1,
    search: search || undefined,
    category: category || undefined,
    account_id: accountId || undefined,
    type: txType || undefined,
    sort,
    sort_dir: sortDir,
  })

  const rows = data?.transactions ?? []

  const totalIn = rows.filter(t => (t.amount ?? 0) > 0).reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalOut = rows.filter(t => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)

  return (
    <div className="app-page">
      <div className="flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="section-kicker mb-2">All</p>
          <h1
            className="font-display text-4xl md:text-5xl text-parchment leading-none"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
          >
            Transactions
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="font-mono text-xs px-4 py-2.5 rounded-lg border border-gold/40 text-gold bg-gold-faint hover:bg-gold/20 transition-colors whitespace-nowrap"
        >
          + add transaction
        </button>
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
        <p className="text-sm font-mono text-coral">Failed to load transactions.</p>
      ) : rows.length === 0 ? (
        <EmptyState message="No transactions yet." />
      ) : (
        <>
          <div className="animate-fade-up delay-2 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

          <Card className="animate-fade-up delay-3 p-0 overflow-hidden">
            <div className="px-5 md:px-6">
              {rows.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
