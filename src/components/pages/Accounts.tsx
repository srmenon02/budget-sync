import { useState } from 'react'
import { useAccounts } from '@/components/hooks/useAccounts'
import { Card, Spinner, Badge, EmptyState } from '@/components/ui'
import { AddAccountModal } from '@/components/features/AddAccountModal'
import type { FinancialAccount } from '@/components/index'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function AccountRow({ account }: { account: FinancialAccount }) {
  const balance = account.current_balance
  const isCredit = account.account_type === 'credit'
  return (
    <div className="flex items-center justify-between py-4 border-b border-ink-border/60 last:border-0 group">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-parchment truncate">
            {account.account_name}
          </span>
          <Badge variant={account.sync_status === 'ok' || account.sync_status === 'manual' ? 'success' : 'default'}>
            {account.account_type}
          </Badge>
        </div>
        <span className="font-mono text-xs text-parchment-dim">
          {account.institution_name || 'Manual'}
          {account.last_four ? ` ····${account.last_four}` : ''}
        </span>
      </div>
      <div className="flex items-center gap-4 shrink-0 ml-4">
        <span className="font-mono text-xs text-parchment-dim">
          {account.sync_status}
        </span>
        <span
          className={`font-display text-xl ${
            balance != null && ((isCredit && balance > 0) || (!isCredit && balance < 0))
              ? 'text-coral'
              : 'text-parchment'
          }`}
          style={{ fontVariationSettings: '"opsz" 24, "wght" 400' }}
        >
          {balance != null && !isNaN(balance) ? fmt(balance) : '—'}
        </span>
      </div>
    </div>
  )
}

export default function Accounts() {
  const { data, isLoading, isError } = useAccounts()
  const [showAdd, setShowAdd] = useState(false)

  const totalBalance = (data ?? []).reduce((s, a) => s + (a.current_balance ?? 0), 0)

  return (
    <div className="app-page">
      <div className="flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="section-kicker mb-2">Your</p>
          <h1
            className="font-display text-4xl md:text-5xl text-parchment leading-none"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
          >
            Accounts
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="font-mono text-xs px-4 py-2.5 rounded-lg border border-gold/40 text-gold bg-gold-faint hover:bg-gold/20 transition-colors whitespace-nowrap"
        >
          + add account
        </button>
      </div>

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} />}

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <p className="text-sm font-mono text-coral">Failed to load accounts.</p>
      ) : data?.length === 0 ? (
        <EmptyState message="No accounts yet." />
      ) : (
        <>
          {/* Summary strip */}
          <div className="animate-fade-up delay-1 font-mono text-xs text-parchment-dim border border-ink-border rounded-lg px-4 py-3.5 bg-ink-card/50 flex items-center justify-between gap-4">
            <span>{data!.length} account{data!.length !== 1 ? 's' : ''}</span>
            <span>
              Total{' '}
              <span className="text-gold font-medium">{fmt(totalBalance)}</span>
            </span>
          </div>

          <Card className="animate-fade-up delay-2 p-0 overflow-hidden">
            <div className="px-5 md:px-6">
              {data!.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

