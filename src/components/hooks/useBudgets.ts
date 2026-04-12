import { useQuery } from '@tanstack/react-query'
import { fetchActivebudget } from '@/api/budgets'
import type { BudgetWithSpent } from '@/api/budgets'

export function useBudgets() {
	return useQuery<BudgetWithSpent | null>({
		queryKey: ['active-budget'],
		queryFn: fetchActivebudget,
		staleTime: 5 * 60 * 1000,
	})
}

