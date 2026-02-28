import axios from 'axios'

const api = axios.create({
  // In local dev, keep same-origin requests so Vite can proxy /v1 to API.
  baseURL: import.meta.env.VITE_API_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT access token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// TODO: add 401 interceptor to refresh token and retry

export default api
