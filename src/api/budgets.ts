import type { AxiosError } from 'axios'

import client from './client'

const ACTIVE_BUDGET_STORAGE_KEY = 'budgetsync.activeBudget'
const LEGACY_TOTALS_STORAGE_KEY = 'budgetsync.legacyTotalsByMonth'
export const OTHER_CATEGORY_NAME = 'Other'

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

type LegacyTransactionListResponse = {
  transactions: Array<{
    amount: number
    category?: string | null
  }>
  total_count: number
  page: number
  limit: number
}

type TransactionListLike =
  | LegacyTransactionListResponse
  | {
      transactions?: Array<{ amount: number; category?: string | null }>
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

function previousMonthKey(d: Date): string {
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return monthKey(prev)
}

function storeActiveBudget(budget: BudgetWithSpent | null): void {
  if (typeof window === 'undefined') return
  if (!budget) return
  try {
    window.localStorage.setItem(ACTIVE_BUDGET_STORAGE_KEY, JSON.stringify(budget))
  } catch {
    // Ignore storage failures (private mode/quota/etc).
  }
}

function readStoredActiveBudget(): BudgetWithSpent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ACTIVE_BUDGET_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BudgetWithSpent
  } catch {
    return null
  }
}

function clearStoredActiveBudget(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(ACTIVE_BUDGET_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

function readLegacyTotalsByMonth(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LEGACY_TOTALS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
}

function writeLegacyTotalsByMonth(totals: Record<string, number>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LEGACY_TOTALS_STORAGE_KEY, JSON.stringify(totals))
  } catch {
    // Ignore storage failures.
  }
}

function storeLegacyTotalForMonth(month: string, total: number): void {
  const current = readLegacyTotalsByMonth()
  current[month] = total
  writeLegacyTotalsByMonth(current)
}

function readLegacyTotalForMonth(month: string): number | undefined {
  const current = readLegacyTotalsByMonth()
  return typeof current[month] === 'number' ? current[month] : undefined
}

function hasOtherCategory(
  categories: BudgetWithSpent['categories'] | undefined,
): boolean {
  return (categories ?? []).some((category) => category.name === OTHER_CATEGORY_NAME)
}

function buildOtherCategory() {
  return {
    name: OTHER_CATEGORY_NAME,
    limit: 0,
    spent: 0,
    remaining: 0,
  }
}

function mergeStoredCategories(
  fresh: BudgetWithSpent['categories'] | undefined,
  stored: BudgetWithSpent['categories'] | undefined,
): BudgetWithSpent['categories'] | undefined {
  const base = [...(fresh ?? [])]
  const known = new Set(base.map((category) => category.name))
  for (const category of stored ?? []) {
    if (known.has(category.name)) continue
    base.push(category)
  }
  return base.length > 0 ? base : undefined
}

function resolveStableTotalAmount(freshTotal: number, ...storedTotals: Array<number | undefined>): number {
  const numericStored = storedTotals.filter(
    (value): value is number => typeof value === 'number',
  )
  if (numericStored.length === 0) {
    return freshTotal
  }
  const bestStored = Math.max(...numericStored)
  // Keep the original configured budget ceiling when legacy responses only expose
  // category limits and can otherwise collapse the overall total after refetches.
  return bestStored > freshTotal ? bestStored : freshTotal
}

export function getTransactionCategoryOptions(
  activeBudget: BudgetWithSpent | null | undefined,
): string[] {
  if (!activeBudget) return []
  const names = (activeBudget.categories ?? []).map((category) => category.name).filter(Boolean)
  if (!names.includes(OTHER_CATEGORY_NAME)) {
    names.push(OTHER_CATEGORY_NAME)
  }
  return names
}

export async function ensureOtherBudgetCategory(): Promise<void> {
  const activeBudget = await fetchActivebudget()
  if (!activeBudget || hasOtherCategory(activeBudget.categories)) {
    return
  }

  if (activeBudget.id.startsWith('legacy-')) {
    try {
      await client.post('/budgets/bulk', {
        month: monthFromLegacyBudgetId(activeBudget.id),
        period: 'monthly',
        items: [{ category: OTHER_CATEGORY_NAME, amount: 0 }],
      })
    } catch {
      // Ignore legacy insert failures and keep local fallback.
    }
  }

  const updatedBudget: BudgetWithSpent = {
    ...activeBudget,
    categories: [...(activeBudget.categories ?? []), buildOtherCategory()],
    updated_at: new Date().toISOString(),
  }
  storeActiveBudget(updatedBudget)
}

function monthFromLegacyBudgetId(budgetId: string): string {
  if (budgetId.startsWith('legacy-')) {
    const candidate = budgetId.replace('legacy-', '').slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(candidate)) {
      return candidate
    }
  }
  return monthKey(new Date())
}

async function getExpenseTotalForMonth(month: string): Promise<number | null> {
  try {
    const { data } = await client.get<TransactionListLike>('/transactions/', {
      params: {
        month,
        type: 'expense',
        limit: 500,
        page: 1,
      },
    })

    const txs = Array.isArray(
      (data as { transactions?: Array<{ amount: number; category?: string | null }> }).transactions,
    )
      ? (
          (data as {
            transactions: Array<{ amount: number; category?: string | null }>
          }).transactions ?? []
        )
      : []

    return txs.reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0)
  } catch {
    return null
  }
}

async function getExpenseTotalsByCategoryForMonth(month: string): Promise<Map<string, number> | null> {
  try {
    const { data } = await client.get<TransactionListLike>('/transactions/', {
      params: {
        month,
        type: 'expense',
        limit: 500,
        page: 1,
      },
    })

    const txs = Array.isArray(
      (data as { transactions?: Array<{ amount: number; category?: string | null }> }).transactions,
    )
      ? (
          (data as {
            transactions: Array<{ amount: number; category?: string | null }>
          }).transactions ?? []
        )
      : []

    const totals = new Map<string, number>()
    for (const tx of txs) {
      const category = String(tx.category ?? '').trim()
      if (!category) continue
      totals.set(category, (totals.get(category) ?? 0) + Math.abs(Number(tx.amount || 0)))
    }
    return totals
  } catch {
    return null
  }
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
    const currentMonth = monthKey(new Date())
    const expenseTotal = await getExpenseTotalForMonth(currentMonth)
    const stored = readStoredActiveBudget()
    const sameBudgetStored = stored?.id === data.id ? stored : null
    const mergedCategories = mergeStoredCategories(
      data.categories,
      sameBudgetStored?.categories,
    )
    const normalized: BudgetWithSpent = {
      ...data,
      total_amount: resolveStableTotalAmount(data.total_amount, sameBudgetStored?.total_amount),
      spent_amount: expenseTotal ?? data.spent_amount ?? 0,
      categories: mergedCategories,
    }
    storeActiveBudget(normalized)
    return normalized
  } catch {
    // Legacy backend fallback: derive a single aggregate budget from /budgets/current.
    const now = new Date()
    const candidateMonths = [monthKey(now), previousMonthKey(now)]

    for (const candidateMonth of candidateMonths) {
      try {
        const { data } = await client.get<LegacyBudgetCurrentResponse>('/budgets/current', {
          params: {
            month: candidateMonth,
            period: 'monthly',
          },
        })

        if (!data.budgets || data.budgets.length === 0) {
          continue
        }

        const totalAmount = data.budgets.reduce((sum, budget) => sum + budget.limit, 0)
        const categoryTotals = await getExpenseTotalsByCategoryForMonth(data.month)

        const mappedCategories = data.budgets.map((budget) => {
          const spent = categoryTotals?.get(budget.category) ?? budget.spent
          return {
            name: budget.category,
            limit: budget.limit,
            spent,
            remaining: budget.limit - spent,
          }
        })

        const spentFromBudgetCategories = mappedCategories.reduce((sum, budget) => sum + budget.spent, 0)

        // Use raw monthly expense total when available to ensure spent always tracks
        // logged expenses even when category matching differs across backend variants.
        const expenseTotal = await getExpenseTotalForMonth(data.month)
        const spentAmount = expenseTotal ?? spentFromBudgetCategories

        const nowIso = new Date().toISOString()
        const legacyBudgetId = `legacy-${data.month}`
        const stored = readStoredActiveBudget()
        const sameBudgetStored = stored?.id === legacyBudgetId ? stored : null
        const storedLegacyTotal = readLegacyTotalForMonth(data.month)
        const totalAmountStable = resolveStableTotalAmount(
          totalAmount,
          sameBudgetStored?.total_amount,
          storedLegacyTotal,
        )

        const mappedBudget: BudgetWithSpent = {
          id: legacyBudgetId,
          owner_id: 'legacy',
          name: 'Current Budget',
          total_amount: totalAmountStable,
          is_active: true,
          spent_amount: spentAmount,
          categories: mergeStoredCategories(mappedCategories, sameBudgetStored?.categories),
          created_at: nowIso,
          updated_at: nowIso,
        }

        storeActiveBudget(mappedBudget)
        storeLegacyTotalForMonth(data.month, mappedBudget.total_amount)
        return mappedBudget
      } catch {
        // Try next candidate month.
      }
    }

    return readStoredActiveBudget()
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
    storeActiveBudget({
      ...data,
      spent_amount: 0,
      categories: (payload.categories ?? []).map((category) => ({
        name: category.name,
        limit: category.amount,
        spent: 0,
        remaining: category.amount,
      })),
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
      const month = monthKey(new Date())
      const { data } = await client.post<LegacyBudgetRead[]>('/budgets/bulk', {
        month,
        period: 'monthly',
        items: categories.map((category) => ({
          category: category.name,
          amount: category.amount,
        })),
      })

      const first = data[0]
      const nowIso = new Date().toISOString()
      const response: BudgetResponse = {
        id: `legacy-${month}`,
        owner_id: first?.user_id ?? 'legacy',
        name: payload.name,
        total_amount: payload.total_amount,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
      }
      storeActiveBudget({
        ...response,
        spent_amount: 0,
        categories: categories.map((category) => ({
          name: category.name,
          limit: category.amount,
          spent: 0,
          remaining: category.amount,
        })),
      })
      storeLegacyTotalForMonth(month, payload.total_amount)
      return response
    }

    const { data } = await client.post<LegacyBudgetRead>('/budgets/', {
      category: payload.name,
      amount: payload.total_amount,
      month: monthKey(new Date()),
      period: 'monthly',
    })

    const mapped = mapLegacyReadToBudgetResponse(data)
    storeActiveBudget({
      ...mapped,
      spent_amount: 0,
    })
    storeLegacyTotalForMonth(monthKey(new Date()), payload.total_amount)
    return mapped
  }
}

export const resetBudget = async (budgetId: string): Promise<BudgetResponse> => {
  try {
    const { data } = await client.post<BudgetResponse>(`/budgets/${budgetId}/reset`)
    clearStoredActiveBudget()
    return data
  } catch {
    // Legacy backend fallback: reset current monthly budget window.
    await client.delete('/budgets/current', {
      params: {
        month: monthFromLegacyBudgetId(budgetId),
        period: 'monthly',
      },
    })

    clearStoredActiveBudget()
    const nowIso = new Date().toISOString()
    return {
      id: budgetId,
      owner_id: 'legacy',
      name: 'Reset',
      total_amount: 0,
      is_active: false,
      created_at: nowIso,
      updated_at: nowIso,
    }
  }
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

