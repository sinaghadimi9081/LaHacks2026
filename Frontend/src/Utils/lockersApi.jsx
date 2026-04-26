import { apiFetch } from './apiFetch.jsx'

export function fetchLockerSites() {
  return apiFetch('/lockers/sites/', 'GET')
}

export function fetchLockerFeed(params = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    searchParams.append(key, value)
  })
  const qs = searchParams.toString()
  return apiFetch(`/lockers/listings/feed/${qs ? `?${qs}` : ''}`, 'GET')
}

export function fetchMyLockerListings() {
  return apiFetch('/lockers/listings/mine/', 'GET')
}

export function reserveLockerListing(payload) {
  return apiFetch('/lockers/listings/reserve/', 'POST', payload)
}

export function confirmLockerDropoff(listingId, payload) {
  return apiFetch(`/lockers/listings/${listingId}/dropoff/`, 'PATCH', payload)
}

export function buyLockerListing(listingId) {
  return apiFetch(`/lockers/listings/${listingId}/buy/`, 'PATCH', {})
}

export function confirmLockerPickup(listingId, payload) {
  return apiFetch(`/lockers/listings/${listingId}/pickup/`, 'PATCH', payload)
}

