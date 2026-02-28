import api from './api'
import type { User } from '../types'

interface LoginRequest {
  username: string
  password: string
}

interface LoginResponse {
  accessToken: string
  tokenType: 'bearer'
  expiresIn: number
  user: User
}

export const login = (payload: LoginRequest) =>
  api.post<LoginResponse>('/v1/auth/login', payload).then((r) => r.data)

export const getMe = () =>
  api.get<User>('/v1/users/me').then((r) => r.data)
