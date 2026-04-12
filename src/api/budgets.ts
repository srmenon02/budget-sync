import type { AxiosError } from 'axios'

import client from './client'

export type BudgetWithSpent = {
  id: string
  owner_id: string
  name: string
  total_amount: number
  is_active: boolean
  spent_amount?: number
  categories?: Array<{
    name: string
    limit: number
    spent: number
    remaining: number
  }>
  created_at: string
  updated_at: string
}

export type BudgetResponse = {
  id: string
  owner_id: string
  name: string
  total_amount: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BudgetCategoryInput = {
  name: string
  amount: number
}

type LegacyBudgetRead = {
  id: string
  user_id: string
  category: string
  amount: number
  month: string
  year: string
  period: 'monthly' | 'paycheck'
  paycheck_number?: number | null
}

type LegacyBudgetCurrentResponse = {
  month: string
  period: 'monthly' | 'paycheck'
  range_start: string
  range_end: string
  budgets: Array<{
    category: string
    limit: number
    spent: number
    remaining: number
    over_budget: boolean
    period: 'monthly' | 'paycheck'
    paycheck_number?: number | null
  }>
}

type ApiErrorDetail = {
  loc?: Array<string | number>
  msg?: string
  type?: string
}

type ApiErrorData = {
  detail?: string | ApiErrorDetail[]
}

function monthKey(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function isLegacyCreateValidation(error: AxiosError<ApiErrorData>): boolean {
  const detail = error.response?.data?.detail
  if (!Array.isArray(detail)) return false

  const requiredFields = new Set(
    detail
      .map((item) => (Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1]) : ''))
      .filter(Boolean),
  )

  return requiredFields.has('amount') && requiredFields.has('month')
}

function mapLegacyReadToBudgetResponse(data: LegacyBudgetRead): BudgetResponse {
  const nowIso = new Date().toISOString()
  return {
    id: data.id,
    owner_id: data.user_id,
    name: data.category,
    total_amount: data.amount,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  }
}

export const fetchActivebudget = async (): Promise<BudgetWithSpent | null> => {
  try {
    const { data } = await client.get<BudgetWithSpent>('/budgets/active')
    return data
  } catch (error) {
    const axiosError = error as AxiosError
    if (axiosError.response?.status !== 404) {
      return null
    }

    // Legacy backend fallback: derive a single aggregate budget from /budgets/current.
    try {
      const { data } = await client.get<LegacyBudgetCurrentResponse>('/budgets/current', {
        params: {
          month: monthKey(new Date()),
          period: 'monthly',
        },
      })

      if (!data.budgets || data.budgets.length === 0) return null

      const totalAmount = data.budgets.reduce((sum, budget) => sum + budget.limit, 0)
      const spentAmount = data.budgets.reduce((sum, budget) => sum + budget.spent, 0)
      const nowIso = new Date().toISOString()

      return {
        id: `legacy-${data.month}`,
        owner_id: 'legacy',
        name: 'Current Budget',
        total_amount: totalAmount,
        is_active: true,
        spent_amount: spentAmount,
        categories: data.budgets.map((budget) => ({
          name: budget.category,
          limit: budget.limit,
          spent: budget.spent,
          remaining: budget.remaining,
        })),
        created_at: nowIso,
        updated_at: nowIso,
      }
    } catch {
      return null
    }
  }
}

export const createBudget = async (payload: {
  name: string
  total_amount: number
  categories?: BudgetCategoryInput[]
}): Promise<BudgetResponse> => {
  try {
    const { data } = await client.post<BudgetResponse>('/budgets/', {
      name: payload.name,
      total_amount: payload.total_amount,
    })
    return data
  } catch (error) {
    const axiosError = error as AxiosError<ApiErrorData>

    // Legacy backend fallback that expects category/amount/month.
    if (!isLegacyCreateValidation(axiosError)) {
      throw error
    }

    const categories = payload.categories ?? []

    if (categories.length > 0) {
      const { data } = await client.post<LegacyBudgetRead[]>('/budgets/bulk', {
        month: monthKey(new Date()),
        period: 'monthly',
        items: categories.map((category) => ({
          category: category.name,
          amount: category.amount,
        })),
      })

      const first = data[0]
      const nowIso = new Date().toISOString()
      return {
        id: first?.id ?? `legacy-${monthKey(new Date())}`,
        owner_id: first?.user_id ?? 'legacy',
        name: payload.name,
        total_amount: payload.total_amount,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
      }
    }

    const { data } = await client.post<LegacyBudgetRead>('/budgets/', {
      category: payload.name,
      amount: payload.total_amount,
      month: monthKey(new Date()),
      period: 'monthly',
    })

    return mapLegacyReadToBudgetResponse(data)
  }
}

export const resetBudget = async (budgetId: string): Promise<BudgetResponse> => {
  const { data } = await client.post<BudgetResponse>(`/budgets/${budgetId}/reset`)
  return data
}

export const exportBudget = async (budgetId: string): Promise<{
  budget: {
    id: string
    name: string
    total_amount: number
    spent_amount: number
    remaining_amount: number
    created_at: string
    exported_at: string
  }
  transactions: Array<{
    id: string
    merchant_name: string | null
    amount: number
    transaction_date: string
    category: string | null
    description: string | null
  }>
}> => {
  const { data } = await client.get<{
    budget: {
      id: string
      name: string
      total_amount: number
      spent_amount: number
      remaining_amount: number
      created_at: string
      exported_at: string
    }
    transactions: Array<{
      id: string
      merchant_name: string | null
      amount: number
      transaction_date: string
      category: string | null
      description: string | null
    }>
  }>(`/budgets/${budgetId}/export`)
  return data
}

