import { useQuery } from '@tanstack/react-query'
import { fetchCurrentBudgets } from '@/api/budgets'
import type { BudgetActual } from '@/api/budgets'

export function useBudgets(month: string) {
	return useQuery<BudgetActual[]>({
		queryKey: ['budgets', month],
		queryFn: () => fetchCurrentBudgets(month),
		staleTime: 5 * 60 * 1000,
	})
}

