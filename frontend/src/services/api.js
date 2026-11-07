import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  // Render's free web service can take ~50 s to wake from sleep.
  timeout: 60000,
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !/\/auth\/(login|register)$/.test(error.config?.url || '')) {
      sessionStorage.removeItem('accessToken')
      window.dispatchEvent(new Event('auth:expired'))
    }
    return Promise.reject(error)
  },
)

export async function fetchDashboard(dataSource = 'manual') {
  const [silos, alerts] = await Promise.all([
    api.get('/silos/', { params: { data_source: dataSource } }),
    api.get('/alerts/'),
  ])
  return {
    silos: silos.data,
    alerts: alerts.data,
  }
}

export const siloService = {
  list: (dataSource) => api.get('/silos/', { params: { data_source: dataSource } }).then(({ data }) => data),
  create: (payload) => api.post('/silos/', payload).then(({ data }) => data),
}

export const alertService = {
  list: () => api.get('/alerts/').then(({ data }) => data),
  acknowledge: (id) => api.patch(`/alerts/${id}/acknowledge`).then(({ data }) => data),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`).then(({ data }) => data),
}

export function notifyAlertsUpdated() {
  window.dispatchEvent(new Event('alerts:updated'))
}

export const readingService = {
  create: (payload) => api.post('/readings/', payload).then(({ data }) => data),
  list: (dataSource) => api.get('/readings/', { params: { data_source: dataSource, limit: 1000 } }).then(({ data }) => data),
  delete: (id) => api.delete(`/readings/${id}`),
}

export const inspectionService = {
  list: () => api.get('/inspections/').then(({ data }) => data),
  create: (payload) => api.post('/inspections/', payload).then(({ data }) => data),
  delete: (id) => api.delete(`/inspections/${id}`),
}

export const reportService = {
  history: (params) => api.get('/reports/history', { params }).then(({ data }) => data),
  summary: (params) => api.get('/reports/summary', { params }).then(({ data }) => data),
}

export const userService = {
  list: () => api.get('/users/').then(({ data }) => data),
  create: (payload) => api.post('/users/', payload).then(({ data }) => data),
  setActive: (id, isActive) => api.patch(`/users/${id}`, null, { params: { is_active: isActive } }).then(({ data }) => data),
}

export default api
