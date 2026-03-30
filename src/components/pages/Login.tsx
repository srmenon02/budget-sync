import { useState } from 'react'
import { isAxiosError } from 'axios'
import { login } from '@/api/auth'
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
      const res = await login({ email, password })
      setAuth(res.access_token, res.user_id, res.email)
      onSuccess()
    } catch (err) {
      const message = extractErrorMessage(err)
      setError(message ?? 'Invalid email or password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back to BudgetSync.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-600">
          Need an account?{' '}
          <button onClick={onNavigateRegister} className="text-brand-600 hover:text-brand-700 font-medium">
            Register
          </button>
        </p>
      </Card>
    </div>
  )
}
