import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentUserSettings, updateCurrentUserSettings } from '@/api/auth'
import { Card, Spinner } from '@/components/ui'

type PaycheckFrequency = 'weekly' | 'bi-weekly' | 'monthly'

function validatePaydayDays(primary: number | string, secondary: number | string): string | null {
  const p = Number(primary)
  const s = Number(secondary)

  if (!Number.isInteger(p) || p < 1 || p > 31) {
    return 'Primary payday must be between 1 and 31'
  }
  if (!Number.isInteger(s) || s < 1 || s > 31) {
    return 'Secondary payday must be between 1 and 31'
  }
  if (p === s) {
    return 'Primary and secondary payday cannot be the same'
  }
  return null
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    display_name: '',
    primary_payday_day: 1,
    secondary_payday_day: 15,
    paycheck_frequency: 'monthly' as PaycheckFrequency,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['user-settings'],
    queryFn: fetchCurrentUserSettings,
  })

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        display_name: settings.display_name ?? '',
        primary_payday_day: settings.primary_payday_day,
        secondary_payday_day: settings.secondary_payday_day,
        paycheck_frequency: settings.paycheck_frequency,
      })
    }
  }, [settings])

  const updateMutation = useMutation({
    mutationFn: (payload: typeof formData) => updateCurrentUserSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] })
      setFormError(null)
    },
    onError: () => {
      setFormError('Failed to update settings')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const validationError = validatePaydayDays(formData.primary_payday_day, formData.secondary_payday_day)
    if (validationError) {
      setFormError(validationError)
      return
    }

    updateMutation.mutate(formData)
  }

  if (isLoading) return <Spinner />
  if (isError) return <p className="text-sm font-mono text-coral">Failed to load settings</p>

  return (
    <div className="app-page">
      <div className="animate-fade-up">
        <div>
          <p className="section-kicker mb-2">User</p>
          <h1
            className="font-display text-4xl md:text-5xl text-parchment leading-none"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 300', fontStyle: 'italic' }}
          >
            Settings
          </h1>
        </div>
      </div>

      <Card className="animate-fade-up delay-1 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-mono text-parchment-dim mb-2">Display Name</label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="Your display name"
              className="w-full"
            />
          </div>

          {/* Paycheck Frequency */}
          <div>
            <label className="block text-sm font-mono text-parchment-dim mb-2">Paycheck Frequency</label>
            <select
              value={formData.paycheck_frequency}
              onChange={(e) => setFormData({ ...formData, paycheck_frequency: e.target.value as PaycheckFrequency })}
              className="w-full"
            >
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <p className="font-mono text-xs text-parchment-dim/70 mt-1">
              This determines how transactions and budgets are grouped in paycheck mode.
            </p>
          </div>

          {/* Primary Payday */}
          <div>
            <label className="block text-sm font-mono text-parchment-dim mb-2">Primary Payday (day of month)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={formData.primary_payday_day}
              onChange={(e) => setFormData({ ...formData, primary_payday_day: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Secondary Payday */}
          <div>
            <label className="block text-sm font-mono text-parchment-dim mb-2">Secondary Payday (day of month)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={formData.secondary_payday_day}
              onChange={(e) => setFormData({ ...formData, secondary_payday_day: Number(e.target.value) })}
              className="w-full"
            />
            <p className="font-mono text-xs text-parchment-dim/70 mt-1">
              Used for bi-weekly paychecks. Must be different from primary payday.
            </p>
          </div>

          {/* Error Message */}
          {formError && <p className="font-mono text-xs text-coral">{formError}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="font-mono text-xs px-4 py-2.5 rounded-lg border border-gold/40 text-gold bg-gold-faint hover:bg-gold/20 transition-colors disabled:opacity-50 w-full"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </Card>
    </div>
  )
}
