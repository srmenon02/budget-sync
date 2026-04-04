import client from './client'

export interface TellerConnectConfig {
  provider: 'teller'
  application_id: string
  environment: string
  user_id: string
  is_configured: boolean
  is_stub: boolean
}

export const getTellerConnectConfig = async (): Promise<TellerConnectConfig> => {
  const { data } = await client.post<TellerConnectConfig>('/bank-sync/connect-token')
  return data
}

export interface DevSeedResponse {
  status: string
  user_id: string
  created_account: number
  created_transactions: number
  account_id: string
}

export const seedDevData = async (): Promise<DevSeedResponse> => {
  const { data } = await client.post<DevSeedResponse>('/dev/seed')
  return data
}
