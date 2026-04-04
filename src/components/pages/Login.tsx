import { useState } from 'react'
import { isAxiosError } from 'axios'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

function extractErrorMessage(err: unknown): string | null {
  if (!isAxiosError(err)) {
    return null
  }

  if (!err.response) {
    return 'Could not reach the API. Check that the backend is running on http://localhost:8000 and CORS allows your frontend origin (localhost/127.0.0.1).'
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

interface LoginProps {
  onSuccess: () => void
  onNavigateRegister: () => void
}

export default function Login({ onSuccess, onNavigateRegister }: LoginProps) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      console.log('[Login] Submitting with email:', email)
      const res = await login({ email, password })
      console.log('[Login] Login succeeded, got response:', res)
      setAuth(res.access_token, res.refresh_token, res.user_id, res.email)
      console.log('[Login] Auth state updated')
      // Small delay to ensure localStorage is written and interceptor picks up new token
      await new Promise(resolve => setTimeout(resolve, 50))
      console.log('[Login] Calling onSuccess to navigate')
      onSuccess()
    } catch (err) {
      console.error('[Login] Login error:', err)
      const message = extractErrorMessage(err)
      const finalMessage = message ?? 'Invalid email or password.'
      console.error('[Login] Setting error:', finalMessage)
      setError(finalMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-[26rem] animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-8 md:mb-10">
          <span
            className="font-display text-5xl md:text-6xl text-gold"
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
          className="rounded-2xl border border-ink-border p-6 md:p-8 flex flex-col gap-5 md:gap-6"
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
              Welcome back
            </h1>
            <p className="font-mono text-xs text-parchment-dim mt-1">sign in to your account</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-parchment-muted uppercase tracking-wider">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
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
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            {error ? (
              <p className="font-mono text-xs text-coral border border-coral/20 bg-coral/5 rounded-lg px-3 py-2">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg bg-gold text-ink font-mono text-sm font-medium py-3 hover:bg-gold-dim transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'signing in…' : 'sign in →'}
            </button>
          </form>

          <p className="font-mono text-xs text-parchment-dim text-center">
            no account?{' '}
            <button
              onClick={onNavigateRegister}
              className="text-gold hover:text-gold-dim transition-colors"
            >
              register
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
