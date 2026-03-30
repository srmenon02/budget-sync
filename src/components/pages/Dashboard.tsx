import { useAccounts } from '@/components/hooks/useAccounts'
import { useTransactions } from '@/components/hooks/useTransactions'
import { Card, Spinner, Badge, EmptyState } from '@/components/ui'
import type { FinancialAccount, Transaction } from '@/components/index'

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function AccountCard({ account }: { account: FinancialAccount }) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 truncate">{account.account_name}</span>
        <Badge variant="success">{account.account_type}</Badge>
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {account.current_balance != null ? fmt(account.current_balance) : '—'}
      </p>
      <p className="text-xs text-gray-400">{account.institution_name}</p>
    </Card>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const amount = tx.amount ?? 0
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-800">
          {tx.merchant_name ?? tx.description ?? 'Transaction'}
        </span>
        <span className="text-xs text-gray-400">
          {tx.category ?? 'Uncategorized'} · {tx.transaction_date}
        </span>
      </div>
      <span className={`text-sm font-semibold ${amount < 0 ? 'text-red-500' : 'text-brand-600'}`}>
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Total balance across all accounts
        </p>
      </div>

      {/* Total balance */}
      <Card className="bg-brand-600 border-0 text-white">
        <p className="text-sm opacity-80">Net Worth</p>
        <p className="text-4xl font-bold mt-1">{fmt(totalBalance)}</p>
        <p className="text-xs opacity-60 mt-1">
          {accounts.data?.length ?? 0} account{accounts.data?.length !== 1 ? 's' : ''} connected
        </p>
      </Card>

      {/* Accounts */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Accounts</h2>
        {accounts.isLoading ? (
          <Spinner />
        ) : accounts.isError ? (
          <p className="text-sm text-red-500">Failed to load accounts.</p>
        ) : accounts.data?.length === 0 ? (
          <EmptyState message="No accounts yet. Seed some data or connect a bank account." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.data!.map((a) => (
              <AccountCard key={a.id} account={a} />
            ))}
          </div>
        )}
      </section>

      {/* Recent transactions */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Recent Transactions</h2>
        {transactions.isLoading ? (
          <Spinner />
        ) : transactions.isError ? (
          <p className="text-sm text-red-500">Failed to load transactions.</p>
        ) : transactions.data?.length === 0 ? (
          <EmptyState message="No transactions yet. POST /dev/seed to populate sample data." />
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
