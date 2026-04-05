import { useQuery } from '@tanstack/react-query'
import { getLoans, type Loan } from '@/api/loans'

export function useLoans() {
	return useQuery<Loan[]>({
		queryKey: ['loans'],
		queryFn: getLoans,
		staleTime: 5 * 60 * 1000,
	})
}
