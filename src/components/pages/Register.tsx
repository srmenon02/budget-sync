import { useState } from 'react'
import { isAxiosError } from 'axios'
import { register } from '@/api/auth'
import { Card } from '@/components/ui'
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
    <div className="max-w-md mx-auto py-10">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
        <p className="text-sm text-gray-500 mt-1">Start managing your money with BudgetSync.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="text-sm text-gray-700">
            Display Name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <label className="text-sm text-gray-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <label className="text-sm text-gray-700">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {notice ? <p className="text-sm text-brand-700">{notice}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-600">
          Already have an account?{' '}
          <button onClick={onNavigateLogin} className="text-brand-600 hover:text-brand-700 font-medium">
            Sign In
          </button>
        </p>
      </Card>
    </div>
  )
}
