import { apiFetch } from './apiFetch.jsx'

export function fetchItems() {
  return apiFetch('/items/', 'GET')
}

export function createItem(payload) {
  return apiFetch('/items/', 'POST', payload)
}

export function fetchItem(itemId) {
  return apiFetch(`/items/${itemId}/`, 'GET')
}

export function updateItem(itemId, payload) {
  return apiFetch(`/items/${itemId}/`, 'PATCH', payload)
}

export function deleteItem(itemId) {
  return apiFetch(`/items/${itemId}/`, 'DELETE')
}

export function fetchRescuePlan() {
  return apiFetch('/rescue-plan/', 'GET')
}
