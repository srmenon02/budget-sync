import React, { Suspense, lazy } from 'react'
import { useAuthStore } from '@/stores/authStore'

const Dashboard = lazy(() => import('./components/pages/Dashboard'))
const Accounts = lazy(() => import('./components/pages/Accounts'))
const Transactions = lazy(() => import('./components/pages/Transactions'))
const Login = lazy(() => import('./components/pages/Login'))
const Register = lazy(() => import('./components/pages/Register'))

const NAV = [
  { label: 'Overview', path: '/' },
  { label: 'Accounts', path: '/accounts' },
  { label: 'Transactions', path: '/transactions' },
]

function getPage(path: string) {
  if (path.startsWith('/login')) return <Login onSuccess={() => {}} onNavigateRegister={() => {}} />
  if (path.startsWith('/register')) return <Register onSuccess={() => {}} onNavigateLogin={() => {}} />
  if (path.startsWith('/accounts')) return <Accounts />
  if (path.startsWith('/transactions')) return <Transactions />
  return <Dashboard />
}

export default function App() {
  const [path, setPath] = React.useState(window.location.pathname)
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
    if (!token && path !== '/login' && path !== '/register') {
      navigate('/login')
      return
    }
    if (token && (path === '/login' || path === '/register')) {
      navigate('/')
    }
  }, [token, path])

  function renderPage() {
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
      {/* Sidebar nav — desktop; top bar on mobile */}
      {token ? (
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-ink-border bg-ink-card/60 backdrop-blur-sm fixed h-full z-20">
            {/* Logo */}
            <div className="px-7 pt-8 pb-8">
              <div className="flex items-baseline gap-1">
                <span
                  className="font-display text-2xl text-gold leading-none"
                  style={{ fontVariationSettings: '"opsz" 40, "wght" 600', fontStyle: 'italic' }}
                >
                  Ledger
                </span>
                <span className="text-parchment-dim text-xs tracking-widest uppercase ml-1 mb-0.5 font-mono">sync</span>
              </div>
            </div>

            {/* Nav links */}
            <nav className="flex flex-col gap-1.5 px-4 flex-1">
              {NAV.map((n) => (
                <button
                  key={n.path}
                  onClick={() => navigate(n.path)}
                  className={`text-left text-sm px-3.5 py-2.5 rounded-lg transition-all duration-150 font-mono ${
                    isActive(n.path)
                      ? 'text-gold bg-gold-faint border border-gold/20'
                      : 'text-parchment-muted hover:text-parchment hover:bg-ink-raised'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </nav>

            {/* Footer */}
            <div className="px-5 pb-7 border-t border-ink-border pt-4">
              <p className="text-parchment-dim text-xs font-mono truncate mb-2.5">{email}</p>
              <button
                onClick={() => { logout(); navigate('/login') }}
                className="text-xs text-parchment-dim hover:text-coral transition-colors font-mono"
              >
                sign out ↗
              </button>
            </div>
          </aside>

          {/* Mobile top bar */}
          <header className="md:hidden fixed top-0 left-0 right-0 z-20 bg-ink-card/80 backdrop-blur-md border-b border-ink-border flex items-center px-4 h-14">
            <span className="font-display text-xl text-gold italic" style={{ fontVariationSettings: '"opsz" 40, "wght" 600' }}>
              Ledger
            </span>
            <div className="flex gap-3 ml-5">
              {NAV.map((n) => (
                <button
                  key={n.path}
                  onClick={() => navigate(n.path)}
                  className={`text-xs font-mono transition-colors ${isActive(n.path) ? 'text-gold' : 'text-parchment-muted hover:text-parchment'}`}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="ml-auto text-xs text-parchment-dim hover:text-coral font-mono transition-colors"
            >
              out ↗
            </button>
          </header>

          {/* Main content */}
          <main className="flex-1 md:ml-60 min-h-screen pt-14 md:pt-0">
            <div className="max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-10">
              <Suspense fallback={<div className="text-parchment-dim font-mono text-sm py-20 text-center">loading…</div>}>
                {renderPage()}
              </Suspense>
            </div>
          </main>
        </div>
      ) : (
        <Suspense fallback={<div className="text-parchment-dim font-mono text-sm py-20 text-center">loading…</div>}>
          {renderPage()}
        </Suspense>
      )}
    </div>
  )
}
