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
  token_type: string
  user_id: string
  email: string
}

export const register = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const { data } = await client.post<AuthResponse>('/auth/register', payload)
  return data
}

export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
  const { data } = await client.post<AuthResponse>('/auth/login', payload)
  return data
}
