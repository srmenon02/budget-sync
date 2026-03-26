import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return <div style={{padding: 24}}>BudgetSync web (MVP)</div>
}

createRoot(document.getElementById('root')!).render(<App />)
