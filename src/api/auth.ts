import client from './client'

export interface RegisterPayload {
  email: string
  password: string
  display_name?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user_id: string
  email: string
}

export interface RegisterResponse {
  status: 'authenticated' | 'pending_verification'
  message: string
  email: string
  user_id: string | null
  access_token: string | null
  refresh_token: string | null
  token_type: string
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserSettings {
  user_id: string
  email: string
  display_name: string | null
  primary_payday_day: number
  secondary_payday_day: number
  paycheck_frequency: 'weekly' | 'bi-weekly' | 'monthly'
}

export const register = async (payload: RegisterPayload): Promise<RegisterResponse> => {
  const { data } = await client.post<RegisterResponse>('/auth/register', payload)
  return data
}

export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
  try {
    console.log('[API] Posting to /auth/login with email:', payload.email)
    const { data } = await client.post<AuthResponse>('/auth/login', payload)
    console.log('[API] /auth/login response:', data)
    if (!data.access_token || !data.user_id || !data.email) {
      throw new Error('Server returned incomplete authentication response')
    }
    return data
  } catch (error) {
    console.error('[API] Login request failed:', error)
    throw error
  }
}

export const refreshSession = async (refreshToken: string): Promise<RefreshResponse> => {
  const { data } = await client.post<RefreshResponse>('/auth/refresh', { refresh_token: refreshToken })
  return data
}

export const fetchCurrentUserSettings = async (): Promise<UserSettings> => {
  const { data } = await client.get<UserSettings>('/auth/me')
  return data
}

export const updateCurrentUserSettings = async (payload: {
  display_name?: string | null
  primary_payday_day?: number
  secondary_payday_day?: number
  paycheck_frequency?: 'weekly' | 'bi-weekly' | 'monthly'
}): Promise<UserSettings> => {
  const { data } = await client.patch<UserSettings>('/auth/me', payload)
  return data
}
