import client from './client'
import type { Transaction } from '@/components/index'

export const fetchTransactions = async (limit = 100): Promise<Transaction[]> => {
  const { data } = await client.get<Transaction[]>('/transactions/', { params: { limit } })
  return data
}

export const createTransaction = async (payload: {
  account_id: string | null
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
