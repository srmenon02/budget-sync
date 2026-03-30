import { useQuery } from '@tanstack/react-query'
import { fetchTransactions } from '@/api/transactions'
import type { Transaction } from '@/components/index'

export function useTransactions(limit = 100) {
  return useQuery<Transaction[]>({
    queryKey: ['transactions', limit],
    queryFn: () => fetchTransactions(limit),
    staleTime: 5 * 60 * 1000,
  })
}
