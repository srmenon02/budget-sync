import { useState } from 'react'
import { useTransactions } from '@/components/hooks/useTransactions'
import { Card, Spinner, Badge, EmptyState } from '@/components/ui'
import { AddTransactionModal } from '@/components/features/AddTransactionModal'
import type { Transaction } from '@/components/index'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const amount = tx.amount ?? 0
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-800">
          {tx.merchant_name ?? tx.description ?? 'Transaction'}
        </span>
        <span className="text-xs text-gray-400">
          {tx.transaction_date}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {tx.category && <Badge>{tx.category}</Badge>}
        <span className={`text-sm font-semibold ${amount < 0 ? 'text-red-500' : 'text-brand-600'}`}>
          {fmt(amount)}
        </span>
      </div>
    </div>
  )
}

export default function Transactions() {
  const { data, isLoading, isError } = useTransactions(200)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white font-medium hover:bg-brand-700"
        >
          + Add Transaction
        </button>
      </div>
      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} />}

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <p className="text-sm text-red-500">Failed to load transactions.</p>
      ) : data?.length === 0 ? (
        <EmptyState message="No transactions yet. Run POST /dev/seed to add sample data." />
      ) : (
        <Card>
          {data!.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </Card>
      )}
    </div>
  )
}
