import { useQuery } from '@tanstack/react-query'
import { fetchCurrentBudgets } from '@/api/budgets'
import type { BudgetCurrentResponse } from '@/api/budgets'

export function useBudgets(month: string, period: 'monthly' | 'paycheck', startDate?: string, endDate?: string) {
	return useQuery<BudgetCurrentResponse>({
		queryKey: ['budgets', month, period, startDate, endDate],
		queryFn: () => fetchCurrentBudgets(month, period, startDate, endDate),
		staleTime: 5 * 60 * 1000,
	})
}

