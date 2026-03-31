import { useQuery } from '@tanstack/react-query'
import { fetchAccountsSummary, type AccountsSummary } from '@/api/accounts'

export function useAccountSummary() {
  return useQuery<AccountsSummary>({
    queryKey: ['accounts', 'summary'],
    queryFn: fetchAccountsSummary,
    staleTime: 5 * 60 * 1000,
  })
}
