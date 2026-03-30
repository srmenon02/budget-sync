import React, { Suspense, lazy } from 'react'
import { useAuthStore } from '@/stores/authStore'

const Dashboard = lazy(() => import('./components/pages/Dashboard'))
const Accounts = lazy(() => import('./components/pages/Accounts'))
const Transactions = lazy(() => import('./components/pages/Transactions'))
const Login = lazy(() => import('./components/pages/Login'))
const Register = lazy(() => import('./components/pages/Register'))

const NAV = [
  { label: 'Dashboard', path: '/' },
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-6">
        <span className="text-brand-600 font-bold text-lg">BudgetSync</span>
        {token ? (
          <>
            <div className="flex gap-4">
              {NAV.map((n) => (
                <button
                  key={n.path}
                  onClick={() => navigate(n.path)}
                  className={`text-sm font-medium transition-colors ${
                    (n.path === '/' ? path === '/' : path.startsWith(n.path))
                      ? 'text-brand-600'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-gray-500">{email}</span>
              <button
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => navigate('/login')}
              className={`text-sm px-3 py-1.5 rounded-md border ${path === '/login' ? 'border-brand-500 text-brand-700' : 'border-gray-300 text-gray-700'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className={`text-sm px-3 py-1.5 rounded-md border ${path === '/register' ? 'border-brand-500 text-brand-700' : 'border-gray-300 text-gray-700'}`}
            >
              Register
            </button>
          </div>
        )}
      </nav>

      {/* Page */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading…</div>}>
          {renderPage()}
        </Suspense>
      </main>
    </div>
  )
}
