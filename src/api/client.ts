import axios, { type AxiosError } from 'axios'
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
    console.log('[Client] Adding Authorization header')
    config.headers.Authorization = `Bearer ${token}`
  } else {
    console.log('[Client] No token in auth store')
  }
  console.log(`[Client] ${config.method?.toUpperCase()} ${config.url}`)
  return config
})

client.interceptors.response.use(
  (response) => {
    console.log(`[Client] Response ${response.status} from ${response.config.url}`)
    return response
  },
  (error: AxiosError) => {
    console.error(`[Client] Error ${error.response?.status} from ${error.config?.url}:`, error.response?.data)
    if (error.response?.status === 401) {
      console.log('[Client] Got 401, logging out and redirecting to /login')
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client