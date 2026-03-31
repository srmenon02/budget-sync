import client from './client'

export type BudgetActual = {
	category: string
	limit: number
	spent: number
	remaining: number
	over_budget: boolean
}

type BudgetCurrentResponse = {
	month: string
	budgets: BudgetActual[]
}

type BudgetWriteResponse = {
	id: string
	user_id: string
	category: string
	amount: number
	month: string
	year: string
}

export const fetchCurrentBudgets = async (month: string): Promise<BudgetActual[]> => {
	const { data } = await client.get<BudgetCurrentResponse>('/budgets/current', {
		params: { month },
	})
	return data.budgets
}

export const upsertBudget = async (payload: {
	category: string
	amount: number
	month: string
}): Promise<BudgetWriteResponse> => {
	const { data } = await client.post<BudgetWriteResponse>('/budgets/', payload)
	return data
}

