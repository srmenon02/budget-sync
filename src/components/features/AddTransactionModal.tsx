import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTransaction } from '@/api/transactions'
import { OTHER_CATEGORY_NAME, ensureOtherBudgetCategory } from '@/api/budgets'
import { useAccounts } from '@/components/hooks/useAccounts'
import { useLoans } from '@/components/hooks/useLoans'
import { Modal, Spinner } from '@/components/ui'

interface Props {
  onClose: () => void
  budgetCategories: string[]
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function AddTransactionModal({ onClose, budgetCategories }: Props) {
  const queryClient = useQueryClient()
  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const { data: loans, isLoading: loansLoading } = useLoans()

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [merchant, setMerchant] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [accountId, setAccountId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [txType, setTxType] = useState<'expense' | 'income'>('expense')
  const [loanId, setLoanId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (category === OTHER_CATEGORY_NAME) {
        await ensureOtherBudgetCategory()
      }
      return createTransaction({
        amount: txType === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount)),
        date,
        merchant_name: merchant || undefined,
        description: description || undefined,
        category: category || undefined,
        account_id: accountId,
        notes: notes || undefined,
        is_manual: true,
        loan_id: txType === 'expense' && loanId ? loanId : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['active-budget'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e?.response?.data?.detail ?? 'Failed to create transaction.')
    },
  })

  const canSubmit = Boolean(accountId) && budgetCategories.length > 0 && category.length > 0

  return (
    <Modal title="Add Transaction" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          if (budgetCategories.length === 0) {
            setError('Create a budget with subcategories before logging transactions.')
            return
          }
          if (!category || !budgetCategories.includes(category)) {
            setError('Select a valid budget category before logging a transaction.')
            return
          }
          mutation.mutate()
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Type *</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTxType('expense')}
              className={`flex-1 font-mono text-xs px-3 py-2 rounded-lg border transition-colors ${
                txType === 'expense'
                  ? 'border-coral/60 text-coral bg-coral/10'
                  : 'border-ink-border text-parchment-dim hover:text-parchment'
              }`}
            >
              Expense (−)
            </button>
            <button
              type="button"
              onClick={() => setTxType('income')}
              className={`flex-1 font-mono text-xs px-3 py-2 rounded-lg border transition-colors ${
                txType === 'income'
                  ? 'border-jade/60 text-jade bg-jade/10'
                  : 'border-ink-border text-parchment-dim hover:text-parchment'
              }`}
            >
              Income (+)
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Amount (USD) *</span>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 12.50"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Date *</span>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Merchant</span>
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="e.g. Whole Foods"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional note"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Category *</span>
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={budgetCategories.length === 0}
          >
            <option value="">Select budget category</option>
            {budgetCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {budgetCategories.length === 0 ? (
            <p className="font-mono text-xs text-coral border border-coral/20 bg-coral/5 rounded-lg px-3 py-2">
              Create an active budget with subcategories before adding transactions.
            </p>
          ) : null}
        </label>

        {txType === 'expense' ? (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Apply to loan</span>
            {loansLoading ? (
              <div className="mt-1"><Spinner /></div>
            ) : (
              <select
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
                disabled={!loans || loans.length === 0}
              >
                <option value="">No linked loan</option>
                {(loans ?? []).map((loan) => (
                  <option key={loan.id} value={loan.id}>{loan.name}</option>
                ))}
              </select>
            )}
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Account</span>
          {accountsLoading ? (
            <div className="mt-1"><Spinner /></div>
          ) : !accounts || accounts.length === 0 ? (
            <p className="font-mono text-xs text-coral border border-coral/20 bg-coral/5 rounded-lg px-3 py-2">
              Create an account first before adding transactions.
            </p>
          ) : (
            <select
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Select account</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name}</option>
              ))}
            </select>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional notes"
            className="resize-none"
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
            disabled={mutation.isPending || !canSubmit}
            className="px-4 py-2.5 font-mono text-xs rounded-lg bg-gold text-white font-medium hover:bg-gold-dim transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Adding...' : 'Add Transaction'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
