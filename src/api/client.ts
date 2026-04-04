import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'

declare global {
  interface ImportMeta {
    env: Record<string, string | undefined>
  }
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
})

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Track whether a refresh is already in flight to avoid multiple concurrent refreshes.
let _refreshPromise: Promise<string> | null = null

async function _doRefresh(refreshToken: string): Promise<string> {
  // Call the refresh endpoint directly without importing auth.ts to avoid circular imports.
  const res = await axios.post<{ access_token: string; refresh_token: string }>(
    `${client.defaults.baseURL}/auth/refresh`,
    { refresh_token: refreshToken }
  )
  const { setAuth, userId, email } = useAuthStore.getState()
  setAuth(res.data.access_token, res.data.refresh_token, userId ?? '', email ?? '')
  return res.data.access_token
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Only attempt silent refresh once per request; never retry the refresh call itself.
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      const { refreshToken } = useAuthStore.getState()
      if (refreshToken) {
        original._retry = true
        try {
          if (!_refreshPromise) {
            _refreshPromise = _doRefresh(refreshToken).finally(() => {
              _refreshPromise = null
            })
          }
          const newToken = await _refreshPromise
          original.headers.Authorization = `Bearer ${newToken}`
          return client(original)
        } catch {
          // Refresh failed — clear session and redirect to login.
        }
      }
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client