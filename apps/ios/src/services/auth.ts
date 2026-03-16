import api, { withBearerToken } from '@/src/lib/api';
import type { AuthResponse, User } from '@/src/types/domain';

interface LoginRequest {
  username: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export function login(payload: LoginRequest) {
  return api.post<AuthResponse>('/v1/auth/login', payload).then((response) => response.data);
}

export function register(payload: RegisterRequest) {
  return api.post<AuthResponse>('/v1/auth/register', payload).then((response) => response.data);
}

export function getMe(token?: string | null) {
  return api
    .get<User>('/v1/users/me', withBearerToken(token))
    .then((response) => response.data);
}
