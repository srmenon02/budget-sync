import { useState } from 'react'
import { isAxiosError } from 'axios'
import { register } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

function extractErrorMessage(err: unknown): string | null {
  if (!isAxiosError(err)) {
    return null
  }

  if (!err.response) {
    return 'Could not reach the API. Check that the backend is running on http://localhost:8000.'
  }

  const data = err.response.data as { detail?: unknown } | undefined
  const detail = data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string }
    if (typeof first?.msg === 'string') {
      return first.msg
    }
    return 'Request validation failed. Please review your inputs.'
  }

  if (detail && typeof detail === 'object') {
    const maybeMsg = (detail as { message?: string }).message
    if (typeof maybeMsg === 'string') {
      return maybeMsg
    }
  }

  return null
}

interface RegisterProps {
  onSuccess: () => void
  onNavigateLogin: () => void
}

export default function Register({ onSuccess, onNavigateLogin }: RegisterProps) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    try {
      const res = await register({
        email,
        password,
        display_name: displayName || undefined,
      })

      if (res.status === 'authenticated' && res.access_token && res.user_id) {
        setAuth(res.access_token, res.user_id, res.email)
        onSuccess()
        return
      }

      setNotice(res.message)
    } catch (err) {
      const message = extractErrorMessage(err)
      setError(message ?? 'Could not register with those details.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <span
            className="font-display text-5xl text-gold"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 500', fontStyle: 'italic' }}
          >
            Ledger
          </span>
          <p className="font-mono text-xs text-parchment-dim mt-2 uppercase tracking-widest">
            personal finance sync
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-ink-border p-8 flex flex-col gap-5"
          style={{
            background: 'linear-gradient(160deg, #1e1e28 0%, #141418 100%)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div>
            <h1
              className="font-display text-2xl text-parchment"
              style={{ fontVariationSettings: '"opsz" 32, "wght" 400', fontStyle: 'italic' }}
            >
              Open a ledger
            </h1>
            <p className="font-mono text-xs text-parchment-dim mt-1">create your account</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="optional"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 6 characters"
              />
            </label>

            {error ? (
              <p className="font-mono text-xs text-coral border border-coral/20 bg-coral/5 rounded-lg px-3 py-2">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="font-mono text-xs text-gold border border-gold/20 bg-gold/5 rounded-lg px-3 py-2">
                {notice}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg bg-gold text-ink font-mono text-sm font-medium py-2.5 hover:bg-gold-dim transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'creating…' : 'create account →'}
            </button>
          </form>

          <p className="font-mono text-xs text-parchment-dim text-center">
            have an account?{' '}
            <button
              onClick={onNavigateLogin}
              className="text-gold hover:text-gold-dim transition-colors"
            >
              sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
