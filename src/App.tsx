import React, { Suspense, lazy } from 'react'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { refreshSession } from '@/api/auth'

const Dashboard = lazy(() => import('./components/pages/Dashboard'))
const Accounts = lazy(() => import('./components/pages/Accounts'))
const Transactions = lazy(() => import('./components/pages/Transactions'))
const Budget = lazy(() => import('./components/pages/Budget'))
const Loans = lazy(() => import('./components/pages/Loans'))
const Login = lazy(() => import('./components/pages/Login'))
const Register = lazy(() => import('./components/pages/Register'))

const NAV = [
  { label: 'Overview', path: '/' },
  { label: 'Accounts', path: '/accounts' },
  { label: 'Income and Expenses', path: '/transactions' },
  { label: 'Budget', path: '/budget' },
  { label: 'Loans', path: '/loans' },
]

function getPage(path: string) {
  if (path.startsWith('/login')) return <Login onSuccess={() => {}} onNavigateRegister={() => {}} />
  if (path.startsWith('/register')) return <Register onSuccess={() => {}} onNavigateLogin={() => {}} />
  if (path.startsWith('/accounts')) return <Accounts />
  if (path.startsWith('/transactions')) return <Transactions />
  if (path.startsWith('/budget')) return <Budget />
  if (path.startsWith('/loans')) return <Loans />
  return <Dashboard />
}

export default function App() {
  const [path, setPath] = React.useState(window.location.pathname)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const token = useAuthStore((s) => s.token)
  const email = useAuthStore((s) => s.email)
  const logout = useAuthStore((s) => s.logout)

  React.useEffect(() => {
    const handler = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  function navigate(to: string) {
    window.history.pushState(null, '', to)
    setPath(to)
  }

  React.useEffect(() => {
    if (!hasHydrated) {
      return
    }
    if (!token && path !== '/login' && path !== '/register') {
      navigate('/login')
      return
    }
    if (token && (path === '/login' || path === '/register')) {
      navigate('/')
    }
  }, [hasHydrated, token, path])

  // Proactively refresh the access token on app load so the user stays logged in.
  React.useEffect(() => {
    if (!hasHydrated) return
    const { refreshToken, setAuth, userId, email } = useAuthStore.getState()
    if (!refreshToken) return
    refreshSession(refreshToken)
      .then((res) => {
        setAuth(res.access_token, res.refresh_token, userId ?? '', email ?? '')
      })
      .catch(() => {
        // Refresh token has expired — let the user log in again.
        useAuthStore.getState().logout()
      })
  }, [hasHydrated])

  function renderPage() {
    if (!hasHydrated) {
      return <div className="text-parchment-dim font-mono text-sm py-20 text-center">Loading...</div>
    }
    if (path.startsWith('/login')) {
      return <Login onSuccess={() => navigate('/')} onNavigateRegister={() => navigate('/register')} />
    }
    if (path.startsWith('/register')) {
      return <Register onSuccess={() => navigate('/')} onNavigateLogin={() => navigate('/login')} />
    }
    if (!token) {
      return <Login onSuccess={() => navigate('/')} onNavigateRegister={() => navigate('/register')} />
    }
    return getPage(path)
  }

  const isActive = (navPath: string) =>
    navPath === '/' ? path === '/' : path.startsWith(navPath)

  return (
    <div className="min-h-screen">
      {token ? (
        <div className="min-h-screen">
          <header className="sticky top-0 z-30 border-b border-ink-border/80 bg-ink-card/90 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 md:px-10 py-4 md:py-6">
              <div className="flex flex-wrap items-center gap-4 md:gap-5">
                <div className="min-w-0">
                  <span
                    className="font-display text-4xl md:text-5xl text-gold leading-none"
                    style={{ fontVariationSettings: '"opsz" 52, "wght" 700' }}
                  >
                    Ledger
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-3">
                  <p className="hidden md:block text-xs font-mono text-parchment-dim max-w-[220px] truncate">{email}</p>
                  <button
                    onClick={() => { logout(); navigate('/login') }}
                    className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-lg border border-ink-border text-parchment-muted hover:text-parchment hover:bg-ink-raised transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    sign out
                  </button>
                </div>
              </div>

              <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Primary">
                {NAV.map((n) => (
                  <button
                    key={n.path}
                    onClick={() => navigate(n.path)}
                    aria-current={isActive(n.path) ? 'page' : undefined}
                    className={`whitespace-nowrap font-mono text-xs md:text-sm px-3.5 py-2 rounded-lg border transition-colors ${
                      isActive(n.path)
                        ? 'text-white bg-gold border-gold'
                        : 'text-parchment-muted border-ink-border hover:text-parchment hover:bg-ink-raised'
                    }`}
                  >
                    {n.label}
                  </button>
                ))}
              </nav>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 md:px-10 py-8 md:py-12">

            <Suspense fallback={<div className="text-parchment-dim font-mono text-sm py-20 text-center">Loading...</div>}>
              {renderPage()}
            </Suspense>
          </main>
        </div>
      ) : (
        <Suspense fallback={<div className="text-parchment-dim font-mono text-sm py-20 text-center">Loading...</div>}>
          {renderPage()}
        </Suspense>
      )}
    </div>
  )
}
