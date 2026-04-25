import { apiFetch } from './apiFetch.jsx'

export function fetchCsrfToken() {
  return apiFetch('/auth/csrf/', 'GET')
}

export function signupUser(payload) {
  return apiFetch('/auth/signup/', 'POST', payload)
}

export function loginUser(payload) {
  return apiFetch('/auth/login/', 'POST', payload)
}

export function logoutUser() {
  return apiFetch('/auth/logout/', 'POST', {})
}

export function refreshAuth() {
  return apiFetch('/auth/refresh/', 'POST', {})
}

export function fetchAuthMe() {
  return apiFetch('/auth/me/', 'GET')
}
