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
