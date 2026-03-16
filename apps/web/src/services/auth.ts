import api from './api'
import type { User } from '../types'

// Shared response shape for both login and register
export interface AuthResponse {
  accessToken: string
  tokenType: 'bearer'
  expiresIn: number
  user: User
}

interface LoginRequest {
  username: string
  password: string
}

interface RegisterRequest {
  username: string
  email: string
  password: string
  display_name?: string
}

export const login = (payload: LoginRequest) =>
  api.post<AuthResponse>('/v1/auth/login', payload).then((r) => r.data)

export const register = (payload: RegisterRequest) =>
  api.post<AuthResponse>('/v1/auth/register', payload).then((r) => r.data)

export const getMe = () =>
  api.get<User>('/v1/users/me').then((r) => r.data)
