import { create } from 'zustand';
import { isPremiumPlan } from '@/src/lib/format';
import { getStoredString, removeStoredString, setStoredString } from '@/src/lib/storage';
import { getMe } from '@/src/services/auth';
import type { AuthResponse, User } from '@/src/types/domain';

const ACCESS_TOKEN_KEY = 'myndral.access_token';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  pendingAuth: AuthResponse | null;
  hydrated: boolean;
  isHydrating: boolean;
  isPremium: boolean;
  isAuthenticated: boolean;
  hydrate: () => Promise<void>;
  setPendingAuth: (auth: AuthResponse) => void;
  clearPendingAuth: () => void;
  setSession: (user: User, token: string) => Promise<void>;
  applyPendingAuth: () => Promise<void>;
  clearSession: () => Promise<void>;
}

function buildSession(user: User | null, accessToken: string | null) {
  return {
    user,
    accessToken,
    isPremium: isPremiumPlan(user?.subscriptionPlan),
    isAuthenticated: Boolean(accessToken),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...buildSession(null, null),
  pendingAuth: null,
  hydrated: false,
  isHydrating: false,

  hydrate: async () => {
    if (get().hydrated || get().isHydrating) {
      return;
    }

    set({ isHydrating: true });
    const token = await getStoredString(ACCESS_TOKEN_KEY);

    if (!token) {
      set({
        ...buildSession(null, null),
        hydrated: true,
        isHydrating: false,
      });
      return;
    }

    try {
      const user = await getMe(token);
      set({
        ...buildSession(user, token),
        hydrated: true,
        isHydrating: false,
      });
    } catch {
      await removeStoredString(ACCESS_TOKEN_KEY);
      set({
        ...buildSession(null, null),
        hydrated: true,
        isHydrating: false,
      });
    }
  },

  setPendingAuth: (auth) => {
    set({ pendingAuth: auth });
  },

  clearPendingAuth: () => {
    set({ pendingAuth: null });
  },

  setSession: async (user, token) => {
    await setStoredString(ACCESS_TOKEN_KEY, token);
    set({
      ...buildSession(user, token),
      hydrated: true,
      pendingAuth: null,
    });
  },

  applyPendingAuth: async () => {
    const pending = get().pendingAuth;
    if (!pending) {
      return;
    }

    await setStoredString(ACCESS_TOKEN_KEY, pending.accessToken);
    set({
      ...buildSession(pending.user, pending.accessToken),
      hydrated: true,
      pendingAuth: null,
    });
  },

  clearSession: async () => {
    await removeStoredString(ACCESS_TOKEN_KEY);
    set({
      ...buildSession(null, null),
      hydrated: true,
      pendingAuth: null,
    });
  },
}));
