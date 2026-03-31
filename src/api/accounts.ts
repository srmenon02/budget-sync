import client from './client'
import type { FinancialAccount } from '@/components/index'

type AccountApiModel = {
  id: string
  user_id: string
  provider?: string | null
  external_id?: string | null
  name: string
  type?: string | null
  balance_current?: number | null
  currency?: string | null
  last_synced_at?: string | null
}

type AccountsSummaryApiModel = {
  accounts: AccountApiModel[]
  total_balance: number
}

export type AccountsSummary = {
  accounts: FinancialAccount[]
  totalBalance: number
}

function mapAccount(account: AccountApiModel): FinancialAccount {
  return {
    id: account.id,
    owner_id: account.user_id,
    institution_name: account.provider ?? 'Manual',
    account_name: account.name,
    account_type: account.type ?? 'other',
    last_four: null,
    current_balance: account.balance_current ?? null,
    is_manual: (account.provider ?? 'manual') === 'manual',
    is_shared_with_partner: false,
    sync_status: (account.provider ?? 'manual') === 'teller' ? 'ok' : 'manual',
    last_synced_at: account.last_synced_at ?? null,
    created_at: new Date().toISOString(),
  }
}

export const fetchAccounts = async (): Promise<FinancialAccount[]> => {
  const { data } = await client.get<AccountApiModel[]>('/accounts/')
  return data.map(mapAccount)
}

export const fetchAccountsSummary = async (): Promise<AccountsSummary> => {
  const { data } = await client.get<AccountsSummaryApiModel>('/accounts/summary')
  return {
    accounts: data.accounts.map(mapAccount),
    totalBalance: data.total_balance,
  }
}

export const connectTellerAccount = async (payload: {
  enrollment_id: string
  access_token: string
  institution_name?: string
  account_id?: string
  account_name?: string
  account_type?: string
  last_four?: string
}): Promise<FinancialAccount> => {
  const { data } = await client.post<AccountApiModel>('/accounts/connect-teller', payload)
  return mapAccount(data)
}

export const createManualAccount = async (payload: {
  name: string
  type?: string
  provider?: string
  balance_current?: number
  currency?: string
}): Promise<FinancialAccount> => {
  const { data } = await client.post<AccountApiModel>('/accounts/', payload)
  return mapAccount(data)
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