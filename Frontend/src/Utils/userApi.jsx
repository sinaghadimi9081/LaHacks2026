import { apiFetch } from './apiFetch.jsx'

export function fetchMyProfile() {
  return apiFetch('/users/me/', 'GET')
}

export function updateMyProfile(payload) {
  const config =
    payload instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : {}

  return apiFetch('/users/me/', 'PATCH', payload, config)
}

export function fetchMarketplaceProfile() {
  return apiFetch('/users/profile/', 'GET')
}

export function fetchMarketplaceProfileById(userId) {
  return apiFetch(`/users/profile/${userId}/`, 'GET')
}
