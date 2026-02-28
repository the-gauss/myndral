import { create } from 'zustand'
import { INTERNAL_ACCESS_TOKEN_KEY } from '../services/api'
import type { InternalUser } from '../types'

interface AuthStore {
  user: InternalUser | null
  accessToken: string | null
  isAuthenticated: boolean
  setSession: (user: InternalUser, token: string) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: localStorage.getItem(INTERNAL_ACCESS_TOKEN_KEY),
  isAuthenticated: Boolean(localStorage.getItem(INTERNAL_ACCESS_TOKEN_KEY)),

  setSession: (user, token) => {
    localStorage.setItem(INTERNAL_ACCESS_TOKEN_KEY, token)
    set({ user, accessToken: token, isAuthenticated: true })
  },

  clearSession: () => {
    localStorage.removeItem(INTERNAL_ACCESS_TOKEN_KEY)
    set({ user: null, accessToken: null, isAuthenticated: false })
  },
}))
