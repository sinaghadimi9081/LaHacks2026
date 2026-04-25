import { apiFetch } from './apiFetch.jsx'

export function createSharePost(payload) {
  return apiFetch('/share/', 'POST', payload)
}

export function fetchShareFeed() {
  return apiFetch('/share/feed/', 'GET')
}

export function fetchSharePost(sharePostId) {
  return apiFetch(`/share/${sharePostId}/`, 'GET')
}

export function claimSharePost(sharePostId, payload = {}) {
  return apiFetch(`/share/${sharePostId}/claim/`, 'PATCH', payload)
}
