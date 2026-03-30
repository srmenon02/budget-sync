import { useAccounts } from '@/components/hooks/useAccounts'
import { Card, Spinner, Badge, EmptyState } from '@/components/ui'
import type { FinancialAccount } from '@/components/index'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function AccountRow({ account }: { account: FinancialAccount }) {
  const balance = account.current_balance
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-800">
          {account.account_name}
        </span>
        <span className="text-xs text-gray-400">
          {account.institution_name}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="success">{account.account_type}</Badge>
        <span className="text-sm font-semibold text-gray-900">
          {balance != null && !isNaN(balance) ? fmt(balance) : '—'}
        </span>
      </div>
    </div>
  )
}

export default function Accounts() {
  const { data, isLoading, isError } = useAccounts()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <p className="text-sm text-red-500">Failed to load accounts.</p>
      ) : data?.length === 0 ? (
        <EmptyState message="No accounts yet. Run POST /dev/seed to add sample data." />
      ) : (
        <Card>
          {data!.map((a) => (
            <AccountRow key={a.id} account={a} />
          ))}
        </Card>
      )}
    </div>
  )
}
