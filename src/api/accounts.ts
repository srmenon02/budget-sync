import client from './client'
import type { FinancialAccount } from '@/components/index'

type AccountApiModel = {
  id: string
  user_id?: string
  provider?: string | null
  external_id?: string | null
  name: string
  type?: string | null
  balance_current?: number | null
  currency?: string | null
  account_class?: 'asset' | 'liability'
  credit_limit?: number | null
  statement_due_day?: number | null
  minimum_due?: number | null
  apr?: number | null
  utilization_percent?: number | null
  last_synced_at?: string | null
}

type AccountsSummaryApiModel = {
  accounts: AccountApiModel[]
  total_assets?: number
  total_liabilities?: number
  net_worth?: number
  total_balance: number
}

export type AccountsSummary = {
  accounts: FinancialAccount[]
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  totalBalance: number
}

function mapAccount(account: AccountApiModel): FinancialAccount {
  const accountType = account.type ?? 'other'
  const accountClass = account.account_class ?? (accountType === 'credit' ? 'liability' : 'asset')
  return {
    id: account.id,
    owner_id: account.user_id ?? '',
    institution_name: account.provider ?? 'Manual',
    account_name: account.name,
    account_type: accountType,
    account_class: accountClass,
    last_four: null,
    current_balance: account.balance_current ?? null,
    credit_limit: account.credit_limit ?? null,
    statement_due_day: account.statement_due_day ?? null,
    minimum_due: account.minimum_due ?? null,
    apr: account.apr ?? null,
    utilization_percent: account.utilization_percent ?? null,
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
    totalAssets: data.total_assets ?? 0,
    totalLiabilities: data.total_liabilities ?? 0,
    netWorth: data.net_worth ?? data.total_balance,
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
  account_class?: 'asset' | 'liability'
  credit_limit?: number
  statement_due_day?: number
  minimum_due?: number
  apr?: number
}): Promise<FinancialAccount> => {
  const { data } = await client.post<AccountApiModel>('/accounts/', payload)
  return mapAccount(data)
}

export const updateAccount = async (
  accountId: string,
  payload: {
    name?: string
    type?: string
    provider?: string
    balance_current?: number
    currency?: string
    account_class?: 'asset' | 'liability'
    credit_limit?: number
    statement_due_day?: number
    minimum_due?: number
    apr?: number
  }
): Promise<FinancialAccount> => {
  const { data } = await client.patch<AccountApiModel>(`/accounts/${accountId}`, payload)
  return mapAccount(data)
}

export const deleteAccount = async (accountId: string): Promise<void> => {
  await client.delete(`/accounts/${accountId}`)
}

export const triggerSync = async (accountId: string): Promise<FinancialAccount> => {
  const { data } = await client.post<FinancialAccount>(`/accounts/${accountId}/sync`)
  return data
}