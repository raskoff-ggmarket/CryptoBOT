import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'

const API_BASE = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 30_000,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken, setToken, logout } = useAuthStore.getState()
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          })
          const newToken = res.data.data.access_token
          setToken(newToken)
          original.headers.Authorization = `Bearer ${newToken}`
          return api(original)
        } catch {
          logout()
          window.location.href = '/login'
        }
      } else {
        logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// API helpers
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, username: string, password: string) =>
    api.post('/auth/register', { email, username, password }),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
}

export const botsApi = {
  list: (params?: Record<string, unknown>) => api.get('/bots', { params }),
  get: (id: number) => api.get(`/bots/${id}`),
  create: (data: unknown) => api.post('/bots', data),
  update: (id: number, data: unknown) => api.patch(`/bots/${id}`, data),
  delete: (id: number) => api.delete(`/bots/${id}`),
  start: (id: number) => api.post(`/bots/${id}/start`),
  stop: (id: number, close_deals = false) =>
    api.post(`/bots/${id}/stop`, { close_deals }),
  pause: (id: number) => api.post(`/bots/${id}/pause`),
  duplicate: (id: number) => api.post(`/bots/${id}/duplicate`),
  stats: (id: number) => api.get(`/bots/${id}/stats`),
  safetyPreview: (id: number) => api.get(`/bots/${id}/safety-preview`),
}

export const dealsApi = {
  list: (params?: Record<string, unknown>) => api.get('/deals', { params }),
  get: (id: number) => api.get(`/deals/${id}`),
  close: (id: number) => api.post(`/deals/${id}/close`),
  cancel: (id: number) => api.post(`/deals/${id}/cancel`),
}

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  performance: () => api.get('/dashboard/performance'),
  recentTrades: (limit = 10) =>
    api.get('/dashboard/recent-trades', { params: { limit } }),
  riskStatus: () => api.get('/dashboard/risk-status'),
}

export const exchangeKeysApi = {
  list: () => api.get('/exchange-keys'),
  create: (data: unknown) => api.post('/exchange-keys', data),
  update: (id: number, data: unknown) => api.patch(`/exchange-keys/${id}`, data),
  delete: (id: number) => api.delete(`/exchange-keys/${id}`),
  validate: (id: number) => api.post(`/exchange-keys/${id}/validate`),
  balances: (id: number) => api.get(`/exchange-keys/${id}/balances`),
}

export const backtestApi = {
  createRun: (data: unknown) => api.post('/backtesting/runs', data),
  listRuns: (params?: Record<string, unknown>) =>
    api.get('/backtesting/runs', { params }),
  getRun: (id: number) => api.get(`/backtesting/runs/${id}`),
  getResults: (id: number) => api.get(`/backtesting/runs/${id}/results`),
  deleteRun: (id: number) => api.delete(`/backtesting/runs/${id}`),
}

export const marketApi = {
  pairs: (quote_asset = 'USDT') =>
    api.get('/market/pairs', { params: { quote_asset } }),
  ticker: (pair: string) => api.get(`/market/ticker/${pair}`),
  klines: (pair: string, interval = '1h', limit = 200) =>
    api.get(`/market/klines/${pair}`, { params: { interval, limit } }),
}

export const indicatorsApi = {
  available: () => api.get('/indicators/available'),
  getBotIndicators: (botId: number) => api.get(`/bots/${botId}/indicators`),
  setBotIndicators: (botId: number, data: unknown) =>
    api.put(`/bots/${botId}/indicators`, data),
}
