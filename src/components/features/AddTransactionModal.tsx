import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTransaction } from '@/api/transactions'
import { useAccounts } from '@/components/hooks/useAccounts'
import { Modal, Spinner } from '@/components/ui'

const CATEGORIES = [
  'Food & Drink', 'Groceries', 'Shopping', 'Transport', 'Entertainment',
  'Health', 'Housing', 'Utilities', 'Income', 'Transfer', 'Other',
]

interface Props {
  onClose: () => void
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function AddTransactionModal({ onClose }: Props) {
  const queryClient = useQueryClient()
  const { data: accounts, isLoading: accountsLoading } = useAccounts()

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [merchant, setMerchant] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [accountId, setAccountId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createTransaction({
        amount: Number(amount),
        date,
        merchant_name: merchant || undefined,
        description: description || undefined,
        category: category || undefined,
        account_id: accountId || undefined,
        notes: notes || undefined,
        is_manual: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e?.response?.data?.detail ?? 'Failed to create transaction.')
    },
  })

  return (
    <Modal title="Add Transaction" onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate() }}
        className="flex flex-col gap-4"
      >
        <label className="text-sm text-gray-700">
          Amount (USD) *
          <input
            required
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="-12.50 (negative = expense)"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <label className="text-sm text-gray-700">
          Date *
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <label className="text-sm text-gray-700">
          Merchant
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="e.g. Whole Foods"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <label className="text-sm text-gray-700">
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional note"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <label className="text-sm text-gray-700">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">— None —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-gray-700">
          Account
          {accountsLoading ? (
            <div className="mt-1"><Spinner /></div>
          ) : (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">— None —</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name}</option>
              ))}
            </select>
          )}
        </label>

        <label className="text-sm text-gray-700">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional notes"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </label>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {mutation.isPending ? 'Adding…' : 'Add Transaction'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
