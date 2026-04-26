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

export interface TellerConfigValidation {
  app_id_set: boolean
  teller_environment: string
  environment_valid: boolean
  cert_b64_present: boolean
  key_b64_present: boolean
  cert_valid_base64?: boolean
  cert_looks_like_pem?: boolean
  key_valid_base64?: boolean
  key_looks_like_pem?: boolean
  cert_and_key_differ?: boolean
  connectivity: 'ok' | 'skipped' | 'connect_error' | 'http_error' | 'unexpected' | 'error'
  connectivity_detail?: string
  overall: 'pass' | 'fail'
}

export const validateTellerConfig = async (): Promise<TellerConfigValidation> => {
  const { data } = await client.get<TellerConfigValidation>('/dev/validate-teller-config')
  return data
}
