import { useQuery } from '@tanstack/react-query'
import { fetchAccounts } from '@/api/accounts'
import type { FinancialAccount } from '@/components/index'

export function useAccounts() {
  return useQuery<FinancialAccount[]>({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
    staleTime: 5 * 60 * 1000,
  })
}
