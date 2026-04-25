import { apiFetch } from './apiFetch.jsx'

export function fetchMyHousehold() {
  return apiFetch('/households/me/', 'GET')
}

export function updateMyHousehold(payload) {
  return apiFetch('/households/me/', 'PATCH', payload)
}
