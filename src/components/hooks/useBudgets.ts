import { useQuery } from '@tanstack/react-query'
import { fetchCurrentBudgets } from '@/api/budgets'
import type { BudgetActual } from '@/api/budgets'

export function useBudgets(month: string, startDate?: string, endDate?: string) {
	return useQuery<BudgetActual[]>({
		queryKey: ['budgets', month, startDate, endDate],
		queryFn: () => fetchCurrentBudgets(month, startDate, endDate),
		staleTime: 5 * 60 * 1000,
	})
}

