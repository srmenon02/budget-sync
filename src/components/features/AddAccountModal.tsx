import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { connectTellerAccount, createManualAccount, updateAccount } from '@/api/accounts'
import { getTellerConnectConfig } from '@/api/bankSync'
import { extractEnrollmentId, extractAccessToken, extractInstitutionName } from '@/lib/teller'
import type { TellerEnrollmentPayload } from '@/lib/teller'
import type { FinancialAccount } from '@/components/index'
import { Modal } from '@/components/ui'

const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'investment', 'loan', 'other']

interface Props {
  onClose: () => void
  account?: FinancialAccount
}

declare global {
  interface Window {
    TellerConnect?: {
      setup: (options: {
        applicationId: string
        environment: string
        onSuccess: (enrollment: TellerEnrollmentPayload) => void
        onExit?: () => void
      }) => { open: () => void }
    }
  }
}

const TELLER_CONNECT_SRC = 'https://cdn.teller.io/connect/connect.js'

function loadTellerScript(): Promise<void> {
  if (window.TellerConnect) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TELLER_CONNECT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Teller Connect script.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = TELLER_CONNECT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Teller Connect script.'))
    document.body.appendChild(script)
  })
}

export function AddAccountModal({ onClose, account }: Props) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(account?.account_name ?? '')
  const [type, setType] = useState(account?.account_type ?? 'checking')
  const [provider, setProvider] = useState(account?.institution_name === 'Manual' ? '' : (account?.institution_name ?? ''))
  const [balance, setBalance] = useState(account?.current_balance != null ? String(account.current_balance) : '')
  const [creditLimit, setCreditLimit] = useState(account?.credit_limit != null ? String(account.credit_limit) : '')
  const [statementDueDay, setStatementDueDay] = useState(account?.statement_due_day != null ? String(account.statement_due_day) : '')
  const [minimumDue, setMinimumDue] = useState(account?.minimum_due != null ? String(account.minimum_due) : '')
  const [apr, setApr] = useState(account?.apr != null ? String(account.apr) : '')
  const [error, setError] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const isCreditType = type === 'credit'
  const isEditing = Boolean(account)

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        type,
        provider: provider || undefined,
        balance_current: balance !== '' ? Number(balance) : undefined,
        currency: 'USD',
        account_class: isCreditType ? 'liability' as const : 'asset' as const,
        credit_limit: isCreditType && creditLimit !== '' ? Number(creditLimit) : undefined,
        statement_due_day: isCreditType && statementDueDay !== '' ? Number(statementDueDay) : undefined,
        minimum_due: isCreditType && minimumDue !== '' ? Number(minimumDue) : undefined,
        apr: isCreditType && apr !== '' ? Number(apr) : undefined,
      }

      return isEditing && account
        ? updateAccount(account.id, payload)
        : createManualAccount(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] })
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e?.response?.data?.detail ?? `Failed to ${isEditing ? 'update' : 'create'} account.`)
    },
  })

  const connectMutation = useMutation({
    mutationFn: async () => {
      const config = await getTellerConnectConfig()
      if (!config.is_configured || !config.application_id) {
        throw new Error('Teller is not configured on the backend yet. Set TELLER_APP_ID and TELLER_ENVIRONMENT in API env.')
      }

      await loadTellerScript()
      if (!window.TellerConnect) {
        throw new Error('Teller Connect failed to initialize.')
      }

      const enrollment = await new Promise<TellerConnectEnrollment>((resolve, reject) => {
        const connect = window.TellerConnect!.setup({
          applicationId: config.application_id,
          environment: config.environment,
          onSuccess: (result) => {
            // Log shape so we can debug mismatches across SDK versions / environments
            console.debug('[TellerConnect] onSuccess raw payload:', JSON.stringify(result, null, 2))
            resolve(result)
          },
          onExit: () => reject(new Error('Bank connection cancelled.')),
        })
        connect.open()
      })

      const enrollmentId = extractEnrollmentId(enrollment)
      const accessToken = extractAccessToken(enrollment)
      if (!enrollmentId || !accessToken) {
        // Surface the actual payload shape so it's visible in browser console
        console.error('[TellerConnect] Could not extract credentials. Raw payload:', enrollment)
        throw new Error(
          `Teller did not return required enrollment credentials. ` +
          `enrollment_id=${enrollmentId ?? 'missing'} access_token=${accessToken ? '[present]' : 'missing'}`
        )
      }

      return connectTellerAccount({
        enrollment_id: enrollmentId,
        access_token: accessToken,
        institution_name: extractInstitutionName(enrollment, provider || 'Teller'),
        account_name: name,
        account_type: type,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] })
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { message?: string; response?: { data?: { detail?: string } } }
      setConnectError(e?.response?.data?.detail ?? e?.message ?? 'Failed to connect bank account.')
    },
  })

  return (
    <Modal title={isEditing ? 'Edit Account' : 'Add Account'} onClose={onClose}>
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

        {isCreditType ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Credit Limit (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="5000.00"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Statement Due Day</span>
              <input
                type="number"
                min="1"
                max="31"
                value={statementDueDay}
                onChange={(e) => setStatementDueDay(e.target.value)}
                placeholder="25"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Minimum Due (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minimumDue}
                onChange={(e) => setMinimumDue(e.target.value)}
                placeholder="35.00"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">APR (%)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={apr}
                onChange={(e) => setApr(e.target.value)}
                placeholder="24.99"
              />
            </label>
          </>
        ) : null}

        {error ? <p className="font-mono text-xs text-coral border border-coral/20 bg-coral/5 rounded-lg px-3 py-2">{error}</p> : null}
        {connectError ? <p className="font-mono text-xs text-coral border border-coral/20 bg-coral/5 rounded-lg px-3 py-2">{connectError}</p> : null}

        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => { setConnectError(null); connectMutation.mutate() }}
              disabled={connectMutation.isPending}
              className="px-4 py-2.5 font-mono text-xs rounded-lg border border-gold/40 text-gold bg-gold-faint hover:bg-gold/20 transition-colors disabled:opacity-50"
            >
              {connectMutation.isPending ? 'Connecting...' : 'Connect Bank (Teller)'}
            </button>
          ) : null}
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
            className="px-4 py-2.5 font-mono text-xs rounded-lg bg-gold text-white font-medium hover:bg-gold-dim transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Account')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
