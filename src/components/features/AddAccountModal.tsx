import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createManualAccount } from '@/api/accounts'
import { Modal } from '@/components/ui'

const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'investment', 'loan', 'other']

interface Props {
  onClose: () => void
}

export function AddAccountModal({ onClose }: Props) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState('checking')
  const [provider, setProvider] = useState('')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createManualAccount({
        name,
        type,
        provider: provider || undefined,
        balance_current: balance !== '' ? Number(balance) : undefined,
        currency: 'USD',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e?.response?.data?.detail ?? 'Failed to create account.')
    },
  })

  return (
    <Modal title="Add Account" onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate() }}
        className="flex flex-col gap-4"
      >
        <label className="text-sm text-gray-700">
          Account Name *
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chase Checking"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <label className="text-sm text-gray-700">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-gray-700">
          Institution
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="e.g. Chase, Wells Fargo"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <label className="text-sm text-gray-700">
          Current Balance (USD)
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
            {mutation.isPending ? 'Adding…' : 'Add Account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
