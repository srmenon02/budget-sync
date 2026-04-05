import client from './client'

export interface Loan {
  id: string
  user_id: string
  name: string
  principal_amount: number
  current_balance: number
  interest_rate: number
  start_date: string | null
  created_at: string
  updated_at: string
  progress_percentage?: number
}

export interface LoanPayment {
  id: string
  loan_id: string
  user_id: string
  amount: number
  payment_date: string
  created_at: string
}

export async function createLoan(data: {
  name: string
  principal_amount: number
  current_balance: number
  interest_rate: number
  start_date?: string
}): Promise<Loan> {
  const response = await client.post('/loans/', data)
  return response.data
}

export async function getLoans(): Promise<Loan[]> {
  const response = await client.get('/loans/')
  return response.data
}

export async function getLoan(loanId: string): Promise<Loan> {
  const response = await client.get(`/loans/${loanId}`)
  return response.data
}

export async function updateLoan(
  loanId: string,
  data: {
    name?: string
    current_balance?: number
    interest_rate?: number
    start_date?: string
  },
): Promise<Loan> {
  const response = await client.put(`/loans/${loanId}`, data)
  return response.data
}

export async function deleteLoan(loanId: string): Promise<void> {
  await client.delete(`/loans/${loanId}`)
}

export async function recordPayment(
  loanId: string,
  data: {
    amount: number
    payment_date: string
  },
): Promise<LoanPayment> {
  const response = await client.post(`/loans/${loanId}/payments`, data)
  return response.data
}

export async function getLoanPayments(loanId: string): Promise<LoanPayment[]> {
  const response = await client.get(`/loans/${loanId}/payments`)
  return response.data
}
