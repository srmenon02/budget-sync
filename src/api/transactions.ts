import client from './client'
import type { Transaction } from '@/components/index'

type TransactionApiModel = {
  id: string
  account_id?: string
  loan_id?: string | null
  amount: number
  merchant_name?: string | null
  description?: string | null
  category?: string | null
  date: string
  transaction_date?: string
  is_manual?: boolean
  created_at?: string
}

type TransactionListApiModel = {
  transactions: TransactionApiModel[]
  total_count: number
  page: number
  limit: number
}

export type TransactionQueryParams = {
  limit?: number
  page?: number
  month?: string
  start_date?: string
  end_date?: string
  category?: string
  account_id?: string
  type?: 'income' | 'expense' | 'transfer'
  search?: string
  sort?: 'date' | 'amount' | 'category'
  sort_dir?: 'asc' | 'desc'
}

export type TransactionListResult = {
  transactions: Transaction[]
  totalCount: number
  page: number
  limit: number
}

function mapTransaction(model: TransactionApiModel): Transaction {
  return {
    id: model.id,
    account_id: model.account_id ?? '',
    loan_id: model.loan_id ?? null,
    amount: model.amount,
    merchant_name: model.merchant_name ?? null,
    description: model.description ?? null,
    category: model.category ?? null,
    transaction_date: model.transaction_date ?? model.date,
    is_manual: Boolean(model.is_manual),
    created_at: model.created_at ?? new Date().toISOString(),
  }
}

export const fetchTransactions = async (params: TransactionQueryParams = {}): Promise<TransactionListResult> => {
  const { data } = await client.get<TransactionListApiModel>('/transactions/', {
    params: {
      limit: params.limit ?? 100,
      page: params.page ?? 1,
      month: params.month,
      start_date: params.start_date,
      end_date: params.end_date,
      category: params.category,
      account_id: params.account_id,
      type: params.type,
      search: params.search,
      sort: params.sort,
      sort_dir: params.sort_dir,
    },
  })

  return {
    transactions: data.transactions.map(mapTransaction),
    totalCount: data.total_count,
    page: data.page,
    limit: data.limit,
  }
}

export const createTransaction = async (payload: {
  account_id?: string | null
  loan_id?: string | null
  amount: number
  description?: string
  merchant_name?: string
  category?: string
  date: string
  notes?: string
  is_manual?: boolean
}): Promise<Transaction> => {
  const { data } = await client.post<Transaction>('/transactions/', payload)
  return data
}

export const updateTransaction = async (
  transactionId: string,
  payload: {
    amount?: number
    description?: string
    merchant_name?: string
    category?: string
    date?: string
    notes?: string
    loan_id?: string | null
  },
): Promise<Transaction> => {
  const { data } = await client.patch<Transaction>(`/transactions/${transactionId}`, payload)
  return data
}

export const deleteTransaction = async (transactionId: string): Promise<void> => {
  await client.delete(`/transactions/${transactionId}`)
}

export const resetTransactions = async (params: {
  month?: string
  start_date?: string
  end_date?: string
  category?: string
  account_id?: string
  type?: 'income' | 'expense' | 'transfer'
}): Promise<void> => {
  await client.delete('/transactions/current', { params })
}

export const bulkImportTransactions = async (payload: {
  account_id: string
  items: Array<{
    amount: number
    description?: string
    merchant_name?: string
    category?: string
    date?: string
    notes?: string
    tx_type?: 'income' | 'expense'
  }>
}): Promise<Transaction[]> => {
  const { data } = await client.post<Transaction[]>('/transactions/bulk', payload)
  return data
}
