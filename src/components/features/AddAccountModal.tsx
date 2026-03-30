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
        className="flex flex-col gap-5"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Account Name *</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chase Checking"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Institution</span>
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="e.g. Chase, Wells Fargo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Current Balance (USD)</span>
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
          />
        </label>

        {error ? <p className="font-mono text-xs text-coral border border-coral/20 bg-coral/5 rounded-lg px-3 py-2">{error}</p> : null}

        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 font-mono text-xs rounded-lg border border-ink-border text-parchment-muted hover:text-parchment transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2.5 font-mono text-xs rounded-lg bg-gold text-ink font-medium hover:bg-gold-dim transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Adding…' : 'Add Account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
