import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  hasHydrated: boolean
  token: string | null
  userId: string | null
  email: string | null
  setAuth: (token: string, userId: string, email: string) => void
  setHasHydrated: (value: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      token: null,
      userId: null,
      email: null,
      setAuth: (token, userId, email) => set({ token, userId, email }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      logout: () => set({ token: null, userId: null, email: null }),
    }),
    {
      name: 'budgetsync-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
