import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAccounts } from '@/components/hooks/useAccounts'
import { Card, Spinner, Badge, EmptyState } from '@/components/ui'
import { AddAccountModal } from '@/components/features/AddAccountModal'
import { deleteAccount } from '@/api/accounts'
import type { FinancialAccount } from '@/components/index'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function AccountRow({ account }: { account: FinancialAccount }) {
  const balance = account.current_balance
  const isCredit = account.account_class === 'liability' || account.account_type === 'credit'
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(account.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] })
    },
  })

  return (
    <>
      {editing ? <AddAccountModal account={account} onClose={() => setEditing(false)} /> : null}
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
            {isCredit && account.credit_limit != null ? ` · limit ${fmt(account.credit_limit)}` : ''}
            {isCredit && account.utilization_percent != null ? ` · ${account.utilization_percent.toFixed(1)}% util` : ''}
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
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="font-mono text-xs px-2.5 py-1.5 rounded border border-coral/50 text-coral hover:bg-coral/10 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? '...' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="font-mono text-xs px-2.5 py-1.5 rounded border border-ink-border text-parchment-dim hover:text-parchment transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-all">
              <button
                onClick={() => setEditing(true)}
                className="font-mono text-xs px-2.5 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="font-mono text-xs px-2.5 py-1.5 rounded border border-ink-border text-parchment-dim hover:text-coral hover:border-coral/50 transition-all"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}


export default function Accounts() {
  const { data, isLoading, isError } = useAccounts()
  const [showAdd, setShowAdd] = useState(false)

  const totalAssets = (data ?? [])
    .filter((a) => a.account_class === 'asset')
    .reduce((sum, account) => sum + (account.current_balance ?? 0), 0)
  const totalLiabilities = (data ?? [])
    .filter((a) => a.account_class === 'liability')
    .reduce((sum, account) => sum + Math.abs(account.current_balance ?? 0), 0)
  const netWorth = totalAssets - totalLiabilities

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
          className="font-mono text-xs px-4 py-2.5 rounded-lg bg-gold text-white hover:bg-gold-dim transition-colors whitespace-nowrap"
        >
          + add account
        </button>
      </div>

      {showAdd ? <AddAccountModal onClose={() => setShowAdd(false)} /> : null}

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
            <span>Assets <span className="text-jade font-medium">{fmt(totalAssets)}</span></span>
            <span>Liabilities <span className="text-coral font-medium">{fmt(totalLiabilities)}</span></span>
            <span>Net Worth <span className="text-gold font-medium">{fmt(netWorth)}</span></span>
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

