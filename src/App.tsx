import React, { Suspense, lazy } from 'react'

const Dashboard = lazy(() => import('./components/pages/Dashboard'))
const Accounts = lazy(() => import('./components/pages/Accounts'))
const Transactions = lazy(() => import('./components/pages/Transactions'))

const NAV = [
  { label: 'Dashboard', path: '/' },
  { label: 'Accounts', path: '/accounts' },
  { label: 'Transactions', path: '/transactions' },
]

function getPage(path: string) {
  if (path.startsWith('/accounts')) return <Accounts />
  if (path.startsWith('/transactions')) return <Transactions />
  return <Dashboard />
}

export default function App() {
  const [path, setPath] = React.useState(window.location.pathname)

  React.useEffect(() => {
    const handler = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  function navigate(to: string) {
    window.history.pushState(null, '', to)
    setPath(to)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-6">
        <span className="text-brand-600 font-bold text-lg">BudgetSync</span>
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
      </nav>

      {/* Page */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading…</div>}>
          {getPage(path)}
        </Suspense>
      </main>
    </div>
  )
}
