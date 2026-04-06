import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BudgetViewMode = 'monthly' | 'paycheck'

interface BudgetViewState {
  mode: BudgetViewMode
  setMode: (mode: BudgetViewMode) => void
}

export const useBudgetViewStore = create<BudgetViewState>()(
  persist(
    (set) => ({
      mode: 'monthly',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'budgetsync-budget-view',
    },
  ),
)
