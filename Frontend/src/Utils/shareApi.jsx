import { apiFetch } from './apiFetch.jsx'

function buildRequestConfig(payload) {
  if (!(payload instanceof FormData)) {
    return {}
  }

  return {}
}

function buildShareQuery(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          searchParams.append(key, item)
        }
      })
      return
    }

    searchParams.append(key, value)
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export function createSharePost(payload) {
  return apiFetch('/share/', 'POST', payload, buildRequestConfig(payload))
}

export function resolveShareLocation(payload) {
  return apiFetch('/share/location/resolve/', 'POST', payload)
}

export function fetchShareFeed(params = {}) {
  return apiFetch(`/share/feed/${buildShareQuery(params)}`, 'GET')
}

export function fetchMySharePosts(params = {}) {
  return apiFetch(`/share/mine/${buildShareQuery(params)}`, 'GET')
}

export function fetchSharePost(sharePostId) {
  return apiFetch(`/share/${sharePostId}/`, 'GET')
}

export function updateSharePost(sharePostId, payload) {
  return apiFetch(`/share/${sharePostId}/`, 'PATCH', payload, buildRequestConfig(payload))
}

export function deleteSharePost(sharePostId) {
  return apiFetch(`/share/${sharePostId}/`, 'DELETE')
}

export function claimSharePost(sharePostId, payload = {}) {
  return apiFetch(`/share/${sharePostId}/claim/`, 'PATCH', payload)
}

export function fetchIncomingShareRequests(params = {}) {
  return apiFetch(`/share/requests/incoming/${buildShareQuery(params)}`, 'GET')
}

export function fetchOutgoingShareRequests(params = {}) {
  return apiFetch(`/share/requests/outgoing/${buildShareQuery(params)}`, 'GET')
}

export function approveShareRequest(requestId, payload = {}) {
  return apiFetch(`/share/requests/${requestId}/approve/`, 'PATCH', payload)
}

export function declineShareRequest(requestId, payload = {}) {
  return apiFetch(`/share/requests/${requestId}/decline/`, 'PATCH', payload)
}
