import { create } from 'zustand'
import type { SubscriptionPlan, User } from '../types'
import { getInitialWebAccessToken } from '../lib/sessionHandoff'

export const ACCESS_TOKEN_KEY = 'access_token'

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

const initialAccessToken = getInitialWebAccessToken()

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  accessToken: initialAccessToken,
  isAuthenticated: Boolean(initialAccessToken),
  isPremium: false,

  setUser: (user, token) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
    set({ user, accessToken: token, isAuthenticated: true, isPremium: checkPremium(user.subscriptionPlan) })
  },

  clearUser: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    set({ user: null, accessToken: null, isAuthenticated: false, isPremium: false })
  },
}))
