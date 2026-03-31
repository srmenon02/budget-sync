import { useQuery } from '@tanstack/react-query'
import { fetchTransactions, type TransactionListResult, type TransactionQueryParams } from '@/api/transactions'

export function useTransactions(params: TransactionQueryParams = {}) {
  return useQuery<TransactionListResult>({
    queryKey: ['transactions', params],
    queryFn: () => fetchTransactions(params),
    staleTime: 5 * 60 * 1000,
  })
}
