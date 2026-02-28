import { create } from 'zustand'
import type { SubscriptionPlan, User } from '../types'

interface UserStore {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isPremium: boolean

  setUser: (user: User, token: string) => void
  clearUser: () => void
}

function checkPremium(plan: SubscriptionPlan): boolean {
  return plan === 'premium_monthly' || plan === 'premium_annual'
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  isAuthenticated: Boolean(localStorage.getItem('access_token')),
  isPremium: false,

  setUser: (user, token) => {
    localStorage.setItem('access_token', token)
    set({ user, accessToken: token, isAuthenticated: true, isPremium: checkPremium(user.subscriptionPlan) })
  },

  clearUser: () => {
    localStorage.removeItem('access_token')
    set({ user: null, accessToken: null, isAuthenticated: false, isPremium: false })
  },
}))
