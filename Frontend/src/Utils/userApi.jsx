import { apiFetch } from './apiFetch.jsx'

export function fetchMyProfile() {
  return apiFetch('/users/me/', 'GET')
}

export function updateMyProfile(payload) {
  return apiFetch('/users/me/', 'PATCH', payload)
}
