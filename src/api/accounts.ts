import client from './client'
import type { FinancialAccount } from '@/components/index'

export const fetchAccounts = async (): Promise<FinancialAccount[]> => {
  const { data } = await client.get<FinancialAccount[]>('/accounts/')
  return data
}

export const connectTellerAccount = async (payload: {
  enrollment_id: string
  access_token: string
  institution_name: string
  account_id: string
  account_name: string
  account_type: string
  last_four?: string
}): Promise<FinancialAccount> => {
  const { data } = await client.post<FinancialAccount>('/accounts/connect-teller', payload)
  return data
}

export const createManualAccount = async (payload: {
  name: string
  type?: string
  provider?: string
  balance_current?: number
  currency?: string
}): Promise<FinancialAccount> => {
  const { data } = await client.post<FinancialAccount>('/accounts/', payload)
  return data
}

export const updateAccount = async (
  accountId: string,
  payload: { is_shared_with_partner?: boolean; account_name?: string }
): Promise<FinancialAccount> => {
  const { data } = await client.patch<FinancialAccount>(`/accounts/${accountId}`, payload)
  return data
}

export const deleteAccount = async (accountId: string): Promise<void> => {
  await client.delete(`/accounts/${accountId}`)
}

export const triggerSync = async (accountId: string): Promise<FinancialAccount> => {
  const { data } = await client.post<FinancialAccount>(`/accounts/${accountId}/sync`)
  return data
}