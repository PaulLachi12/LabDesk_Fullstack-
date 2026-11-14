const DEFAULT_API_URL = 'http://127.0.0.1:8000/api'

export const API_URL = (import.meta.env?.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
export const INCIDENCIAS_API = `${API_URL}/incidencias/`
export const AUTH_API = `${API_URL}/auth/`

function csrfToken() {
  if (typeof document === 'undefined') return ''

  const cookie = document.cookie
    .split('; ')
    .find(value => value.startsWith('csrftoken='))
  return cookie ? cookie.slice('csrftoken='.length) : ''
}

export function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  const token = csrfToken()

  if (token && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRFToken', token)
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  })
}
