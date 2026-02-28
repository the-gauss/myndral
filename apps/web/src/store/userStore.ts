import { create } from 'zustand'
import type { User } from '../types'

interface UserStore {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean

  setUser: (user: User, token: string) => void
  clearUser: () => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  isAuthenticated: Boolean(localStorage.getItem('access_token')),

  setUser: (user, token) => {
    localStorage.setItem('access_token', token)
    set({ user, accessToken: token, isAuthenticated: true })
  },

  clearUser: () => {
    localStorage.removeItem('access_token')
    set({ user: null, accessToken: null, isAuthenticated: false })
  },
}))
