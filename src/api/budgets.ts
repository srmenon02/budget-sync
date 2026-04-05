import client from './client'

export type BudgetActual = {
	category: string
	limit: number
	spent: number
	remaining: number
	over_budget: boolean
	period: 'monthly' | 'paycheck'
}

export type BudgetCurrentResponse = {
	month: string
	period: 'monthly' | 'paycheck'
	range_start: string
	range_end: string
	budgets: BudgetActual[]
}

type BudgetWriteResponse = {
	id: string
	user_id: string
	category: string
	amount: number
	month: string
	year: string
	period: 'monthly' | 'paycheck'
}

export const fetchCurrentBudgets = async (
	month: string,
	period: 'monthly' | 'paycheck',
	start_date?: string,
	end_date?: string,
): Promise<BudgetCurrentResponse> => {
	const { data } = await client.get<BudgetCurrentResponse>('/budgets/current', {
		params: { month, period, start_date, end_date },
	})
	return data
}

export const upsertBudget = async (payload: {
	category: string
	amount: number
	month: string
	period: 'monthly' | 'paycheck'
}): Promise<BudgetWriteResponse> => {
	const { data } = await client.post<BudgetWriteResponse>('/budgets/', payload)
	return data
}

export const bulkUpsertBudgets = async (payload: {
	month: string
	period: 'monthly' | 'paycheck'
	items: Array<{ category: string; amount: number }>
}): Promise<BudgetWriteResponse[]> => {
	const { data } = await client.post<BudgetWriteResponse[]>('/budgets/bulk', payload)
	return data
}

export const resetCurrentBudgets = async (
	month: string,
	period: 'monthly' | 'paycheck',
): Promise<void> => {
	await client.delete('/budgets/current', {
		params: { month, period },
	})
}

